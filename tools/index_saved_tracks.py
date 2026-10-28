#!/usr/bin/env python3
"""Write saved_tracks/index.json, the list of session files the game loads
automatically when index.html is served over http(s).

Usage: python3 tools/index_saved_tracks.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'saved_tracks')


def main():
    names = sorted(n for n in os.listdir(DIR) if n.endswith('.json') and n != 'index.json')
    with open(os.path.join(DIR, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(names, f, indent=1)
    print('saved_tracks/index.json:', len(names), 'files')


if __name__ == '__main__':
    main()
