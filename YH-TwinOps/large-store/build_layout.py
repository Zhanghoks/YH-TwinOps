"""Build a synthetic ~4,000 m2 teaching-store layout inspired by a published
observational sketch of Yonghui Hanhai Haishang store, NOT as-built CAD.
Generates layout.json and a labeled floorplan PNG/SVG. No access to Yonghui data.
"""
from pathlib import Path
import json, math, random
from collections import Counter
P=Path(__file__).parent
rng=random.Random(20261114)
W,D=80,50
zones=[
  ('seafood','水产 / SEAFOOD',-37.3,-17.0,4.7,11.6,'#4c9fcb','service'),
  ('meat','生肉 / FRESH MEAT',-37.3,-3.9,4.7,10.4,'#db827d','service'),
  ('deli','熟食 / DELI',-37.3,10.2,4.7,13.0,'#d8a35a','service'),
  ('produce','蔬果 / PRODUCE',-18.8,-10.5,24.0,21.0,'#6aac65','fresh'),
  ('beverages','饮料 / BEVERAGES',-23.9,13.1,15.0,11.6,'#91b6c8','beverage'),
  ('featured','精选商品',-25.7,2.8,8.8,7.3,'#aec87a','featured'),
  ('bulk','散称粮油 / BULK',-1.0,-9.3,10.6,13.1,'#caa875','bulk'),
  ('frozen','冻品 / FROZEN',0.6,10.6,15.4,13.3,'#7faed6','cold'),
  ('bakery','烘焙 / BAKERY',23.0,-19.5,29.4,10.5,'#e0b875','bakery'),
  ('packaged','包装食品 / PACKAGED',19.5,-3.8,24.0,20.3,'#e0b78a','grocery'),
  ('household','洗化百货 / HOME',34.2,14.4,11.2,17.5,'#a3abc9','household'),
  ('daily','日配 / DAIRY',37.1,-16.6,5.2,11.6,'#87b5bf','cold'),
  ('checkout_n','收银 01 / CHECKOUT',0.3,-21.3,15.0,6.4,'#9db0ab','checkout'),
  ('checkout_e','收银 02 / CHECKOUT',35.7,1.8,7.0,10.5,'#9db0ab','checkout'),
  ('checkout_s','收银 03 / CHECKOUT',-8.7,21.5,15.0,6.6,'#9db0ab','checkout'),
  ('rest','顾客休息区',-31.5,21.5,8.5,5.0,'#b8bdab','rest'),
  ('backroom','后场/库房',-26.9,-21.8,12.0,5.3,'#88939b','backroom'),
]
ZS=[{'id':i,'name':n,'x':x,'z':z,'w':w,'d':d,'color':c,'type':t} for i,n,x,z,w,d,c,t in zones]
F=[]
def add(zone,typ,x,z,w,d,height=1.5,rotation=0):
 F.append({'id':f'F{len(F)+1:03d}','zoneId':zone,'type':typ,'x':round(x,2),'z':round(z,2),'w':round(w,2),'d':round(d,2),'height':round(height,2),'rotation':rotation})
# Perimeter fresh counters: contiguous retail service line, visually unlike gondola rows.
for zone, start, num in [('seafood',-22,6),('meat',-5.9,4),('deli',5.4,6)]:
 for j in range(num):
  add(zone,'service',-37.4,start+j*2.75,3.3,2.25,1.12)
# Produce market tables in multiple irregular islands, plus fresh low refrigerated cases.
for row,z in enumerate([-16.8,-10.5,-4.2]):
 for col,x in enumerate([-28.2,-21.4,-14.6,-7.8]):
  add('produce','produce',x+(0.5 if row==1 else 0),z,4.1,2.8,0.86)
for x in [-30.1,-21.5,-12.9]:add('produce','produce',x,1.0,5.2,2.2,0.85)
# Featured goods in front fresh belt.
for x in [-27.8,-24,-20.2]:add('featured','gondola',x,6.2,3.1,1.35,1.48)
# Drinks as multi-bay coolers and bottles.
for x in [-29.0,-23.6,-18.2]:
 for z in [12.4,16.8]:add('beverages','fridge',x,z,4.0,1.5,2.05)
# Bulk rice and grains, plus condiment shelves
for z in [-13.2,-9.0,-4.8]:
 for x in [-3.4,1.1,5.6]:add('bulk','bulk',x,z,3.5,1.4,1.1)
# Frozen island freezers
for z in [7.3,11.3,15.3]:
 for x in [-4.0,0.5,5.0,9.5]:add('frozen','freezer',x,z,3.3,1.4,0.95)
# bakery with open counter and warm display, not one straight shelf
for x in [14.5,18.7,22.9,27.1,31.3,35.5]:
 for z in [-21.0,-17.1]: add('bakery','bakery',x,z,3.5,1.7,1.35)
# Peripheral dairy cabinets back wall
for z in [-20.2,-16.2,-12.2]:add('daily','fridge',37.9,z,1.2,2.8,2.1)
# Packaged grocery rows (central right). some discontinuous rows to make porous movement
for z in [-10.6,-7.8,-5.0,-2.2,0.6,3.4,6.2,9.0]:
 for x in [13.8,20.0,26.2]:
  add('packaged','gondola',x,z,4.9,1.0,1.54)
# additional packaged foods front as shorter rows
for z in [13.1,16.4]:
 for x in [14.3,20.5,26.7]:add('packaged','gondola',x,z,4.7,1.05,1.54)
# Household right perimeter rows and front
for z in [7.4,11.0,14.6,18.2]:
 for x in [30.0,33.7]:add('household','gondola',x,z,3.4,1.0,1.54)
for x in [11.0,16.0,21.0,26.0,31.0]:add('household','gondola',x,21.8,3.7,1.1,1.54)
# 3 checkout groups, mix self-checkout compact and traditional registers
for x in [-11,-8,-5,-2,1,4,7,10]:add('checkout_n','checkout',x,-22.1,1.3,2.6,1.05)
for z in [-8.2,-5.2,-2.2,0.8,3.8,6.8,9.8,12.8]:add('checkout_e','checkout',37.0,z,2.6,1.2,1.05)
for x in [-14.4,-11.4,-8.4,-5.4,-2.4,0.6,3.6,6.6]:add('checkout_s','checkout',x,21.5,1.3,2.6,1.05)
# customer service and seats
for x in [-34,-31,-28]:add('rest','bench',x,21.5,2.3,0.8,0.6)
for x in [-31.6,-27.9,-24.2,-20.5]:add('backroom','storage',x,-23.1,2.6,1.3,2.2)
layout={
 'name':'YH TwinOps · 永辉瀚海海尚调改逻辑参考（教学概念店）',
 'reference':'https://www.sohu.com/a/838464583_484228',
 'actual':'This is a synthetic interpretation of the observer-drawn Hanhai Haishang store sketch, NOT an official as-built plan.',
 'width':W,'depth':D,'area_m2':W*D,'main_aisle_m':3.0,'gondola_max_height_m':1.6,
 'entrances':[{'id':'south','name':'入口','x':-23,'z':24.1}],
 'exits':[{'id':'north','name':'出口/收银01','x':0,'z':-24.1},{'id':'east','name':'出口/收银02','x':39.1,'z':2},{'id':'south','name':'出口/收银03','x':-11,'z':24.1}],
 'zones':ZS,'fixtures':F,'synthetic':True,
}
(P/'layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2),encoding='utf-8')
print('fixture types:',dict(Counter(f['type'] for f in F)),'count',len(F))

# Author-generated top view; colors are functional groups and not actual surveyed dimensions.
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch
from matplotlib.lines import Line2D
from matplotlib import font_manager
font_file='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
if Path(font_file).exists():font_manager.fontManager.addfont(font_file)
plt.rcParams['font.family']='Noto Sans CJK JP'
fig,ax=plt.subplots(figsize=(16,10.7),facecolor='#10191a')
ax.set_facecolor('#1d282b')
ax.add_patch(Rectangle((-40,-25),80,50,facecolor='#282f32',edgecolor='#e3e7e6',linewidth=2.4))
for t in range(-40,41,5):ax.axvline(t,color='white',alpha=.06,lw=.6)
for t in range(-25,26,5):ax.axhline(t,color='white',alpha=.06,lw=.6)
for z in ZS:
 if z['id'].startswith('checkout'):continue
 ax.add_patch(FancyBboxPatch((z['x']-z['w']/2,z['z']-z['d']/2),z['w'],z['d'],boxstyle='round,pad=0.3',linewidth=1.2,edgecolor='#dbe0dc',facecolor=z['color'],alpha=.23))
for f in F:
 color=next(z['color'] for z in ZS if z['id']==f['zoneId'])
 ax.add_patch(Rectangle((f['x']-f['w']/2,f['z']-f['d']/2),f['w'],f['d'],facecolor=color,edgecolor='#edf5ed',lw=.36,alpha=.84))
for z in ZS:
 if z['id'] in ['checkout_n','checkout_s','checkout_e']:continue
 size=11 if z['id'] not in ['seafood','meat','deli','backroom','rest'] else 9
 ax.text(z['x'],z['z'],z['name'].split(' / ')[0],ha='center',va='center',fontsize=size,fontweight='bold',color='#ffffff',bbox=dict(boxstyle='round,pad=.3',facecolor='#172326',edgecolor='none',alpha=.92))
for p in layout['entrances']:
 ax.scatter(p['x'],p['z'],marker='^',s=200,color='#69eea8',edgecolors='#fff',linewidths=1)
 ax.text(p['x'],p['z']+2.3,'入口',ha='center',color='#aaffc9',fontsize=12,fontweight='bold')
for p in layout['exits']:
 ax.scatter(p['x'],p['z'],marker='s',s=130,color='#f2bc75',edgecolors='#fff',linewidths=1)
ax.plot([-30,-30,-10,2,2,12,23,31],[14,0,-18,-18,-1,-1,-1,9],linestyle='--',color='#75f6c8',linewidth=2.3,alpha=.85)
ax.set_xlim(-44,44);ax.set_ylim(30,-30);ax.set_aspect('equal');ax.set_xticks([]);ax.set_yticks([])
ax.set_title('永辉超市 · 大型门店空间分区重建（教学概念）',fontsize=20,fontweight='bold',color='white',pad=28)
ax.text(-40,27.6,'参考：郑州瀚海海尚店公开探店手绘图 · 非官方施工图 / 面积与尺度为教学假设 · 80m × 50m ≈ 4,000㎡',color='#bacac5',fontsize=10)
fig.savefig(P/'assets'/'floorplan.png',dpi=170,facecolor='#10191a',bbox_inches='tight',pad_inches=.34)
fig.savefig(P/'assets'/'floorplan.svg',facecolor='#10191a',bbox_inches='tight',pad_inches=.34)
plt.close(fig)
print('Saved layout.json and assets/floorplan.png/svg')
