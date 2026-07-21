#!/usr/bin/env python3
"""
One-off: repoint the U.F.101 Creator's inline style colours at the AerialDeck
palette. The stylesheet was rewritten by hand; these are the colours baked into
JSX style={{...}} attributes that a stylesheet change cannot reach.

Deliberately NOT changed:
  - Leaflet layer/path colours, which feed the map screenshot on page 2 of the
    IAA PDF.
  - The zone-type badges (PROHIBITED red / CONDITIONAL yellow / other orange) —
    those are meaningful aviation status colours, not decoration.
  - The red validation warning box — semantically correct as red.

Every replacement asserts its expected hit count, so the script fails loudly
rather than silently missing one. Safe to delete once merged.
"""
import sys

PATH = 'views/uf101-creator.html'

# (old, new, expected_occurrences)
EDITS = [
    # "+ New" button in the sidebar header
    ("style={{background: '#98d59f', color: '#0c3210'}}>+ New",
     "style={{background: 'var(--accent)', color: '#fff'}}>+ New", 1),

    # Zone-dataset line under each flight, and its download link
    ("style={{fontSize: '10px', color: '#98d59f', marginTop: '4px'}}",
     "style={{fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem'}}", 1),
    ("style={{marginLeft: '8px', color: '#ffeb3b', textDecoration: 'underline'}}",
     "style={{marginLeft: '0.5rem', color: 'var(--accent-dark)', textDecoration: 'underline'}}", 1),

    # Rename / Duplicate / Delete were white-on-dark; invisible on a white card
    ("style={{background: 'rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', fontSize: '11px'}}",
     "style={{background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '0.2rem 0.5rem', fontSize: '0.7rem'}}", 1),
    ("style={{background: 'rgba(255,255,255,0.1)', color: '#98d59f', padding: '4px 8px', fontSize: '11px'}}",
     "style={{background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '0.2rem 0.5rem', fontSize: '0.7rem'}}", 1),
    ("style={{background: 'rgba(255,255,255,0.1)', color: '#ff6b6b', padding: '4px 8px', fontSize: '11px'}}",
     "style={{background: 'var(--bg-secondary)', color: '#dc2626', border: '1px solid var(--border)', padding: '0.2rem 0.5rem', fontSize: '0.7rem'}}", 1),

    # Export-flights footer
    ("style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)'}}",
     "style={{marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)'}}", 1),
    ("style={{width: '100%', background: 'rgba(255,255,255,0.1)', color: '#98d59f', padding: '8px', fontSize: '12px'}}",
     "style={{width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'center'}}", 1),

    # Welcome screen
    ("style={{fontSize: '24px', color: '#2d3748', marginBottom: '8px'}}",
     "style={{fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem'}}", 1),
    ("style={{color: '#718096', marginBottom: '32px'}}",
     "style={{color: 'var(--text-muted)', marginBottom: '2rem'}}", 1),
    ("style={{padding: '16px 32px', fontSize: '16px', background: '#0c3210'}}",
     "style={{padding: '0.85rem 1.75rem', fontSize: '1rem'}}", 1),

    # "Locked" field markers, and the locked inputs themselves
    ("style={{color: '#38a169', fontSize: '11px'}}",
     "style={{color: 'var(--accent-dark)', fontSize: '0.7rem'}}", 5),
    ("style={{background: '#f0fff4', color: '#22543d'}}",
     "style={{background: 'var(--accent-light)', color: 'var(--accent-dark)'}}", 5),

    # Remote pilot checkbox row
    ("style={{display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '12px', background: '#f7fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}",
     "style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)'}}", 1),
    ("<small style={{color: '#38a169'}}>Selected:",
     "<small style={{color: 'var(--accent-dark)'}}>Selected:", 1),

    # Detected-zones panel, and its empty state
    ("style={{background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: '8px', padding: '12px'}}",
     "style={{background: 'var(--accent-light)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '0.75rem'}}", 1),
    ("style={{background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', color: '#718096', fontSize: '13px'}}",
     "style={{background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem'}}", 1),

    # Auto-detected read-only zone fields
    ("placeholder=\"Auto-detected from map\" readOnly style={{background: '#f7fafc'}}",
     "placeholder=\"Auto-detected from map\" readOnly style={{background: 'var(--bg-secondary)'}}", 2),

    # Derived date/time summary
    ("style={{color: '#38a169', marginTop: '8px', display: 'block'}}",
     "style={{color: 'var(--accent-dark)', marginTop: '0.5rem', display: 'block'}}", 1),

    # Dashed "draw a shape" hint box
    ("style={{marginBottom: '16px', padding: '12px', background: '#f7fafc', borderRadius: '8px', border: '1px dashed #cbd5e0'}}",
     "style={{marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border)'}}", 1),

    # "Export Options" heading
    ("style={{fontSize: '13px', fontWeight: '600', color: '#4a5568', marginBottom: '12px'}}",
     "style={{fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.75rem'}}", 1),

    # "Export All" card, highlighted as the primary action
    ("style={{background: '#f0fdf4', borderColor: '#86efac'}}",
     "style={{background: 'var(--accent-light)', borderColor: 'var(--accent)'}}", 1),
    ("<div className=\"export-card-icon\" style={{color: '#166534'}}>",
     "<div className=\"export-card-icon\" style={{color: 'var(--accent-dark)'}}>", 1),
]

src = open(PATH, encoding='utf-8').read()
failures = []

for old, new, expected in EDITS:
    found = src.count(old)
    if found != expected:
        failures.append(f"  expected {expected}, found {found}: {old[:80]}...")
        continue
    src = src.replace(old, new)

if failures:
    print("ABORTED — nothing written. Mismatched patterns:")
    print("\n".join(failures))
    sys.exit(1)

open(PATH, 'w', encoding='utf-8').write(src)
print(f"Applied {len(EDITS)} replacements to {PATH}.")
