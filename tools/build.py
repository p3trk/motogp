#!/usr/bin/env python3
"""Build index.html from src/.

Concatenates the source parts into one self-contained page and makes it
ASCII-only (HTML entities / \\u escapes) so it opens correctly from disk
in any browser regardless of encoding detection.

Usage: python3 tools/build.py            -> writes index.html
       python3 tools/build.py --utf8 X   -> also writes a UTF-8 artifact body to X
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def ent(s):
    return ''.join(c if ord(c) < 128 else '&#x%X;' % ord(c) for c in s)


def jsesc(s):
    o = []
    for c in s:
        if ord(c) < 128:
            o.append(c)
        elif ord(c) > 0xFFFF:
            v = ord(c) - 0x10000
            o.append('\\u%04X\\u%04X' % (0xD800 + (v >> 10), 0xDC00 + (v & 0x3FF)))
        else:
            o.append('\\u%04X' % ord(c))
    return ''.join(o)


def main():
    js = (read('core.js').replace('__TRACK__', read('track.txt'))
          + read('world.js') + read('replay.js') + read('render.js') + read('ui.js'))
    head = read('head.html')
    if '--utf8' in sys.argv:
        with open(sys.argv[sys.argv.index('--utf8') + 1], 'w', encoding='utf-8') as f:
            f.write(head + '\n<script>\n(()=>{\n' + js + '\n})();\n</script>\n')
    body = ent(head) + '\n<script>' + jsesc('\n(()=>{\n' + js + '\n})();\n') + '</script>' + ent('\n')
    out = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n'
           + body.replace('<canvas id="game"', '</head>\n<body style="margin:0">\n<canvas id="game"', 1)
           + '</body>\n</html>\n')
    assert all(ord(c) < 128 for c in out)
    with open(os.path.join(ROOT, 'index.html'), 'w', encoding='ascii', newline='\n') as f:
        f.write(out)
    print('index.html', len(out), 'bytes')


if __name__ == '__main__':
    main()
