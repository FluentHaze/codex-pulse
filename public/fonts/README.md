# UI fonts

PingFang SC is requested from the operating system when available. It is not bundled.

The Windows fallback is Noto Sans SC (variable weight 100–900), downloaded from Google Fonts:
https://github.com/google/fonts/tree/main/ofl/notosanssc

The unmodified font is distributed under the SIL Open Font License 1.1; see OFL.txt.
The source font is in src/assets/fonts; Vite hashes its URL for file:// and development builds. The font and license are copied into the packaged renderer by Vite. No runtime font request is needed.
