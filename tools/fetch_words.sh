#!/bin/bash
cd ~/workspace/quran-pronunciation-app/words-raw
for n in $(seq 1 114); do
  f=$(printf "chapter-%03d.json" $n)
  if [ -s "$f" ]; then continue; fi
  curl -s -H "Accept: */*" "https://api.quran.com/api/v4/verses/by_chapter/$n?words=true&word_fields=text_uthmani,audio_url,translation,transliteration&audio=7&fields=text_uthmani&per_page=300" -o "$f"
  echo "fetched $n ($(wc -c < $f) B)"
done
echo ALL-DONE; ls | wc -l
