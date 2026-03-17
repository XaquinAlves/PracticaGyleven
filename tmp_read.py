from pathlib import Path
path=Path('FrontEnd/PracticaGylevenFront/app/neos/Neo.tsx')
text=path.read_text()
line0=text.splitlines()[0]
print(repr(line0))
