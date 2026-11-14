"""Optional high-level GLB shell generator for Blender import/replacement.
Uses synthetic layout.json; browser prototype also creates an interactive version
procedurally so assets can remain editable by agent operations.
"""
import json, math, random, re, sys
from pathlib import Path
import numpy as np
import trimesh
P=Path(__file__).parent
layout=json.loads((P/'layout.json').read_text())
rng=random.Random(144)
scene=trimesh.Scene()
GEOMS={}
count=0
BLOCKOUT = "--blockout" in sys.argv
CURRENT_ID = "SHELL"

def rgba(color):
 c=color.lstrip('#');return [int(c[i:i+2],16) for i in (0,2,4)]+[255]

def cube(name,x,y,z,w,h,d,color):
 global count
 if BLOCKOUT and name in ("fruit-stack", "display-food", "packed-frozen", "sku-pack", "shelf-board", "storage_tote"): return
 count+=1
 # Mesh geometry shared by material, node transform handles dimensions.
 key=color
 if key not in GEOMS:
  mesh=trimesh.creation.box(extents=[1,1,1]);mesh.visual.face_colors=np.tile(rgba(color),(len(mesh.faces),1))
  GEOMS[key]=mesh
 mat=np.eye(4);mat[:3,:3]=np.diag([w,h,d]);mat[:3,3]=[x,y,z]
 scene.add_geometry(GEOMS[key],geom_name=f'unit_{color[1:]}',node_name=f'{CURRENT_ID}__{name}_{count:06d}',transform=mat)

def palette(z):
 return {
 'produce':['#b34b37','#ffb138','#66964f','#cfd76b','#7daa36','#e1a844'],
 'meat':['#c36e77','#f2b1a0','#98555c'],
 'seafood':['#b1cdd0','#75b8c7','#d8e1e2'],
 'deli':['#b87944','#e6b45f','#bf5f4e'],
 'beverages':['#dca53f','#589d6a','#7b9fbe','#cb9c5c'],
 'frozen':['#ddeae9','#b6cae4','#e1c1a4'],
 'household':['#b6bcdf','#7d97b8','#dbc6d9'],
 'bakery':['#dca45a','#be854a','#f2cc91'],
 }.get(z,['#c99c6f','#adc5a0','#aabacb','#d9b889','#d5d0ae'])

# Structural base, perimeter walls, low cutaway in front.
cube('floor',0,-.18,0,80,.36,50,'#949e9c')
for z in [-24.9,24.9]:
 cube('backwall' if z<0 else 'frontwall',0,1.6,z,80,3.2,.25,'#323b3b' if z<0 else '#868f8c')
for x in [-39.9,39.9]:cube('sidewall',x,1.6,0,.25,3.2,50,'#454f4e')
# colored department fascia / wayfinding strips
for zone in layout['zones']:
 if zone['type'] in ['checkout','backroom','rest']:continue
 x,z=zone['x'],zone['z'];w,d=zone['w'],zone['d']
 cube('zone-floor-stripe',x,.02,z,w,.035,d,zone['color'])
# Fixture parametric geometry, portable to Blender. one rect per shelf/checkout + products.
for f in layout['fixtures']:
 CURRENT_ID = f['id']
 t=f['type'];x,z,w,d,h=f['x'],f['z'],f['w'],f['d'],f['height'];zone=f['zoneId'];pal=palette(zone)
 if t=='checkout':
  cube('checkout_base',x,.47,z,w,.94,d,'#56615d')
  cube('checkout_top',x,.97,z,w+.1,.12,d,'#d0d6d2')
  cube('checkout_screen',x,h+.27,z-.2,.43,.42,.12,'#162d33')
  continue
 if t=='bench':cube('bench',x,.44,z,w,.4,d,'#bc966a');continue
 if t=='storage':
  cube('racking',x,h/2,z,w,h,d,'#66757a');
  for k in range(3):cube('storage_tote',x,.32+k*.65,z,.55,.37,.5,['#e9c47f','#a7b7b4','#dd957d'][k])
  continue
 if t=='produce':
  cube('produce-wood-plinth',x,.37,z,w,.72,d,'#8b6d48')
  cube('produce-top',x,.79,z,w,.15,d,'#b69566')
  # open bins of fruit/vegetable colors
  for r in range(3):
   for c in range(8):
    xx=x+(c-3.5)*(w/9);zz=z+(r-1)*(d/4)
    cube('fruit-stack',xx,.92,zz,w/11,.21,d/6,rng.choice(pal))
  continue
 if t in ('freezer','fridge'):
  cube('cold-case',x,h/2,z,w,h,d,'#c7d5d7')
  cube('glass-surface',x,h+.03,z,w+.03,.08,d+.03,'#77a5b8')
  for c in range(6):cube('packed-frozen',x+(c-2.5)*w/7,h+.11,z,.18,.10,d*.45,rng.choice(pal))
  continue
 if t in ('service','bakery','bulk'):
  dark = '#574941' if t=='bakery' else '#626768' if t=='service' else '#8c7354'
  cube('counter-base',x,h*.42,z,w,h*.84,d,dark)
  cube('display-glass',x,h*.9,z,w+.04,.15,d+.04,'#d8d9c7')
  for c in range(7):
   cube('display-food',x+(c-3)*w/8,h+.05,z,.28,.21,d*.42,rng.choice(pal))
  continue
 # 1.54m gondola, 5 shelf tiers, stocked on two sides.
 cube('gondola-frame',x,h/2,z,w,h,d,'#424e4b')
 for lev in range(5):
  yy=.18+lev*(h-.24)/5
  cube('shelf-board',x,yy,z,w,.09,d+.2,'#b6bbb6')
  for c in range(7):
   for side in [-1,1]:
    xxx=x+(c-3)*w/7
    cube('sku-pack',xxx,yy+.17,z+side*.3,w/10,.26,.22,rng.choice(pal))

# Architectural posts & signage lathes (non-branded)
for x in range(-30,40,15):
 for z in [-18,-1,17]:
  cube('structural-column',x,2.5,z,.65,5,.65,'#777e80')
for x,z in [(-34,-7),(-20,-6),(0,8),(19,-4),(23,-18),(33,13)]:
 cube('wayfinding-sign',x,3.5,z,6,.6,.22,'#355d4e')
# geometry export
out=P/'assets'/('yh-large-blockout.glb' if BLOCKOUT else 'yh-large-concept.glb')
scene.export(out)
print('exported',out,'size',round(out.stat().st_size/1024/1024,2),'MiB','nodes',len(scene.graph.nodes))
