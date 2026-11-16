# UI fonts

The desktop UI uses bundled Noto Sans SC (variable weight 100–900) on every platform, with a bundled Noto Sans KR supplement for glyphs absent from SC. No system font is requested in the UI font stack and no runtime download is needed.

Noto Sans SC is downloaded from Google Fonts:
https://github.com/google/fonts/tree/main/ofl/notosanssc

The original TTF remains in src/assets/fonts as the source. Its WOFF2 conversion preserves every character mapping and the variable weight axis. Only the WOFF2 is imported and included in the packaged renderer.

Noto Sans KR is downloaded from https://github.com/google/fonts/tree/main/ofl/notosanskr. The supplement contains its 11,834 character mappings absent from SC, including Korean Hangul and Jamo, and retains variable weights. It is generated with fontTools subset and WOFF2 compression.

The packaged WOFF2 fonts total 9,048,944 bytes, compared with 17,772,300 bytes for the previous SC TTF alone. Vite hashes their URLs for file:// and development builds.

Both fonts are distributed under the SIL Open Font License 1.1; see OFL.txt (SC) and OFL-KR.txt (KR). Those license files are copied into the packaged renderer by Vite.
