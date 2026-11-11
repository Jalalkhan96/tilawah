package com.jalalkhan.tilawah

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.concurrent.thread
import kotlin.math.roundToInt

/**
 * Tilawah native side:
 * Channel "tilawah/audio_decode", method "decodeToPcm16k" {path}
 * Decodes a compressed audio file (MP3) with MediaExtractor/MediaCodec,
 * downmixes to mono, resamples to 16 kHz and returns little-endian
 * PCM16 bytes. Used only for the REFERENCE recitation files; the user's
 * WAV recordings are decoded in pure Dart.
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "tilawah/audio_decode")
            .setMethodCallHandler { call, result ->
                if (call.method == "decodeToPcm16k") {
                    val path = call.argument<String>("path")
                    if (path == null) {
                        result.error("BAD_ARGS", "path argument missing", null)
                    } else {
                        thread {
                            try {
                                val bytes = decodeToPcm16kMono(path)
                                runOnUiThread { result.success(bytes) }
                            } catch (e: Exception) {
                                runOnUiThread {
                                    result.error("DECODE_FAILED", e.message ?: "decode failed", null)
                                }
                            }
                        }
                    }
                } else {
                    result.notImplemented()
                }
            }
    }

    private fun decodeToPcm16kMono(path: String): ByteArray {
        val extractor = MediaExtractor()
        extractor.setDataSource(path)
        var trackIndex = -1
        var format: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
            val f = extractor.getTrackFormat(i)
            val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
            if (mime.startsWith("audio/")) {
                trackIndex = i
                format = f
                break
            }
        }
        require(trackIndex >= 0 && format != null) { "No audio track in $path" }
        extractor.selectTrack(trackIndex)
        val mime = format.getString(MediaFormat.KEY_MIME)!!
        val srcRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        val srcChannels = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT))
            format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 1

        val codec = MediaCodec.createDecoderByType(mime)
        codec.configure(format, null, null, 0)
        codec.start()

        val pcm = ByteArrayOutputStream()
        val bufferInfo = MediaCodec.BufferInfo()
        var inputDone = false
        var outputDone = false
        val timeoutUs = 10_000L
        while (!outputDone) {
            if (!inputDone) {
                val inIndex = codec.dequeueInputBuffer(timeoutUs)
                if (inIndex >= 0) {
                    val inBuf = codec.getInputBuffer(inIndex)!!
                    val sampleSize = extractor.readSampleData(inBuf, 0)
                    if (sampleSize < 0) {
                        codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        inputDone = true
                    } else {
                        codec.queueInputBuffer(inIndex, 0, sampleSize, extractor.sampleTime, 0)
                        extractor.advance()
                    }
                }
            }
            val outIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
            if (outIndex >= 0) {
                val outBuf = codec.getOutputBuffer(outIndex)!!
                if (bufferInfo.size > 0) {
                    val chunk = ByteArray(bufferInfo.size)
                    outBuf.position(bufferInfo.offset)
                    outBuf.limit(bufferInfo.offset + bufferInfo.size)
                    outBuf.get(chunk)
                    pcm.write(chunk)
                }
                codec.releaseOutputBuffer(outIndex, false)
                if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
            }
        }
        codec.stop()
        codec.release()
        extractor.release()

        // PCM16 -> mono floats
        val raw = pcm.toByteArray()
        val shorts = ShortArray(raw.size / 2)
        ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(shorts)
        val mono = FloatArray(raw.size / 2 / srcChannels)
        for (f in mono.indices) {
            var sum = 0f
            for (c in 0 until srcChannels) sum += shorts[f * srcChannels + c] / 32768f
            mono[f] = sum / srcChannels
        }
        // Resample to 16 kHz (linear interpolation)
        val targetRate = 16000
        val resampled = if (srcRate == targetRate) mono else {
            val outLen = (mono.size.toDouble() * targetRate / srcRate).roundToInt().coerceAtLeast(1)
            val out = FloatArray(outLen)
            val ratio = (mono.size - 1).toDouble() / (outLen - 1).coerceAtLeast(1)
            for (i in 0 until outLen) {
                val pos = i * ratio
                val i0 = pos.toInt()
                val i1 = (i0 + 1).coerceAtMost(mono.size - 1)
                val frac = (pos - i0).toFloat()
                out[i] = mono[i0] * (1 - frac) + mono[i1] * frac
            }
            out
        }
        val outBytes = ByteArray(resampled.size * 2)
        val bb = ByteBuffer.wrap(outBytes).order(ByteOrder.LITTLE_ENDIAN)
        for (v in resampled) {
            val clamped = v.coerceIn(-1f, 1f)
            bb.putShort((clamped * 32767).roundToInt().toShort())
        }
        return outBytes
    }
}
