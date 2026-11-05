# Terminal fonts

Shipped with the app and declared in `src/renderer/src/styles/fonts.css`.

- `JetBrainsMono-Variable.ttf`, `JetBrainsMono-Italic-Variable.ttf`: JetBrains Mono
  (https://github.com/JetBrains/JetBrainsMono), SIL Open Font License 1.1.
- `SymbolsNerdFontMono-Regular.ttf`: Symbols Nerd Font Mono from the Nerd Fonts
  v3.5.1 release's `NerdFontsSymbolsOnly.zip` (https://github.com/ryanoasis/nerd-fonts),
  the one-cell variant, so an icon never spills into the next terminal cell. It
  gathers icon sets under their own licences, listed in its README.

The licences live in `src/renderer/public/fonts/`, so the built app carries them
next to the fonts (`out/renderer/fonts/`), as the OFL asks of every copy.
