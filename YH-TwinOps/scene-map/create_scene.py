# YH TwinOps — 永辉生鲜区规划孪生：试点门店基线场景（Blender 生成脚本）
#
# 依据 SPEC.md（~/Downloads/SPEC.md）：
#   - 24 m × 18 m 生鲜区净空间（FR-01 教学数据参数）
#   - 12 条货架通道 R01–R12（preserveRunCount 约束的作用对象）
#   - 4 类商品：蔬菜 / 水果 / 肉品 / 水产（每类 3 条通道，对应 layout.runs[].categoryIds）
#   - 入口对准 2.4 m 主通道；次通道 1.4 m ≥ minPassageWidthM(1.2)
#   - 场景内悬挂"合成数据"标识（SPEC §7.2 数据标签要求）
#
# 运行：blender --python create_scene.py   （前台窗口，脚本保存项目并渲染两张预览图）
# 产物：yh-fresh-area.blend / preview-top.png / preview-iso.png / render-done.txt

import math
import os
from datetime import datetime

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(ROOT, "yh-fresh-area.blend")
TOP_PNG = os.path.join(ROOT, "preview-top.png")
ISO_PNG = os.path.join(ROOT, "preview-iso.png")
DONE = os.path.join(ROOT, "render-done.txt")

# ---------------- 场地参数（单位：米，与 SPEC 教学参数一致） ----------------
W, D = 24.0, 18.0                 # 生鲜区净尺寸
WALL_T, WALL_H = 0.15, 3.0        # 外墙厚度 / 高度
RUN_Y0, RUN_Y1 = 4.5, 14.5        # 货架通道南北范围（长度 10 m）
RUN_W = 1.1                       # 单条通道（双面货架）深度
PERIM_W = 0.9                     # 西侧沿墙通道（员工作业通道，不计入 minPassageWidthM——S5 仅标注不调参）
AISLE = 1.4                       # 次通道宽度
MAIN = 2.4                        # 中央主通道宽度（正对入口）
DOOR_X0, DOOR_X1 = 10.0, 13.0     # 南侧顾客入口（宽 3.0 m；S8：门中轴 x=11.5 与主通道中轴重合）
BACK_X0, BACK_X1 = 21.0, 22.8     # 北侧后仓门
SIGN_H = 2.05                     # 通道标牌悬挂高度
MX = (DOOR_X0 + DOOR_X1) / 2      # 入口/主通道公共中轴（S8 对齐后 = 11.5，门玻璃/中梃由此推导）

# 4 类商品：category_id 与颜色（category_id 供后续 StoreConfig/CSV 映射使用）
CATS = {
    "veg":     {"name": "蔬菜", "color": (0.18, 0.58, 0.23, 1), "floor": (0.74, 0.88, 0.75, 1)},
    "fruit":   {"name": "水果", "color": (0.93, 0.52, 0.09, 1), "floor": (0.93, 0.83, 0.66, 1)},
    "meat":    {"name": "肉品", "color": (0.78, 0.19, 0.17, 1), "floor": (0.91, 0.76, 0.74, 1)},
    "seafood": {"name": "水产", "color": (0.13, 0.40, 0.72, 1), "floor": (0.72, 0.83, 0.92, 1)},
}

# 12 条货架通道：按 6 组背靠背货架岛排布，每岛 2 条（品类分区：西→东 蔬菜→水果→肉品→水产）
RUNS = [
    ("R01", "veg"), ("R02", "veg"),
    ("R03", "veg"), ("R04", "fruit"),
    ("R05", "fruit"), ("R06", "fruit"),
    ("R07", "meat"), ("R08", "meat"),
    ("R09", "meat"), ("R10", "seafood"),
    ("R11", "seafood"), ("R12", "seafood"),
]

# ---------------- 场景初始化 ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "YH_Fresh_Area"
scene.unit_settings.system = "METRIC"
try:
    scene.view_settings.view_transform = "Standard"  # 保持品类配色鲜明
except Exception:
    pass
scene["store_id"] = "YH-SIM-001"
scene["synthetic_data"] = True  # SPEC：合成数据标记

COLS = {}
for name in ("Architecture", "Runs", "Fixtures", "Signage"):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    COLS[name] = c

# ---------------- 字体（中文标牌） ----------------
FONT = None
for path in (
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
):
    if os.path.exists(path):
        try:
            FONT = bpy.data.fonts.load(path)
            print("FONT OK:", path)
            break
        except Exception as exc:  # noqa: BLE001
            print("FONT FAIL:", path, exc)

# ---------------- 材质与几何辅助 ----------------

def make_mat(name, color, rough=0.55, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except AttributeError:
            m.blend_method = "BLEND"
    return m


def lighten(color, t):
    return tuple(c * (1 - t) + t for c in color[:3]) + (1.0,)


def box(name, x0, x1, y0, y1, z0, z1, mat, col="Architecture"):
    """直接以网格数据建模，避免依赖 ops 上下文（5.x 启动脚本阶段不可用）。"""
    verts = (
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
    )
    faces = ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    ob = bpy.data.objects.new(name, mesh)
    COLS[col].objects.link(ob)
    return ob


def text(name, body, size, mat, loc, rx=0.0, rz=0.0, col="Signage", extrude=0.004):
    cu = bpy.data.curves.new(name, type="FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = extrude
    if FONT:
        cu.font = FONT
    ob = bpy.data.objects.new(name, cu)
    ob.location = loc
    ob.rotation_euler = (rx, 0, rz)
    cu.materials.append(mat)
    COLS[col].objects.link(ob)
    return ob


# 材质表
M_FLOOR = make_mat("floor", (0.72, 0.70, 0.67, 1), rough=0.85)
M_WALL = make_mat("wall", (0.80, 0.80, 0.81, 1), rough=0.8)
M_DARK = make_mat("dark", (0.14, 0.14, 0.15, 1), rough=0.6)
M_METAL = make_mat("metal", (0.55, 0.56, 0.58, 1), rough=0.45, metal=0.3)
M_BOARD = make_mat("board", (0.74, 0.75, 0.77, 1), rough=0.5)
M_COL = make_mat("column", (0.52, 0.52, 0.53, 1), rough=0.85)
M_WOOD = make_mat("wood", (0.72, 0.55, 0.38, 1), rough=0.7)
M_GLASS = make_mat("glass", (0.75, 0.85, 0.9, 1), rough=0.12, metal=0.1, alpha=0.22)
M_WHITE = make_mat("white", (0.92, 0.92, 0.93, 1), rough=0.5)
M_TEXT = make_mat("text", (0.12, 0.13, 0.14, 1), rough=0.5)
M_TEXT_W = make_mat("text_white", (0.96, 0.96, 0.97, 1), rough=0.5)
M_SLATE = make_mat("slate", (0.16, 0.18, 0.21, 1), rough=0.5)
M_SERVICE = make_mat("service", (0.32, 0.44, 0.55, 1), rough=0.6)
M_CRATE = make_mat("crate", (0.62, 0.68, 0.45, 1), rough=0.7)
CAT_MATS = {k: make_mat(f"cat_{k}", v["color"], rough=0.5) for k, v in CATS.items()}
CAT_FLOOR_MATS = {k: make_mat(f"catfloor_{k}", v["floor"], rough=0.85) for k, v in CATS.items()}
CAT_SOFT_MATS = {k: make_mat(f"catsoft_{k}", lighten(v["color"], 0.38), rough=0.6) for k, v in CATS.items()}
CAT_BOARD_MATS = {k: make_mat(f"catboard_{k}", lighten(v["color"], 0.78), rough=0.6) for k, v in CATS.items()}  # S3b 顶层板淡品类色（俯视透出四段）
M_ICE = make_mat("ice", (0.84, 0.92, 0.96, 1), rough=0.25)                              # S7c 水产冰台冰面
M_POP = make_mat("pop", (0.95, 0.82, 0.15, 1), rough=0.4)                               # S7a 促销 POP 黄牌
M_TRAY_MEAT = make_mat("tray_meat", lighten(CATS["meat"]["color"], 0.45), rough=0.6)    # S7c 肉品台粉色托盘
M_SIGN_GREEN = make_mat("sign_green", (0.13, 0.5, 0.2, 1), rough=0.6)                   # S7d 自助称重地贴
GOODS_MATS = {
    k: [make_mat(f"goods_{k}_{i}", lighten(v["color"], t), rough=0.55)
        for i, t in enumerate((0.05, 0.28, 0.48))]
    for k, v in CATS.items()
}

# ---------------- 地面与外墙 ----------------
box("Floor", -0.3, W + 0.3, -0.3, D + 0.3, -0.12, 0.0, M_FLOOR)
box("Threshold_Entrance", DOOR_X0, DOOR_X1, 0.0, 0.55, 0.002, 0.01, M_DARK)


def wall_with_opening(name, x0, x1, y0, y1, open_x0, open_x1):
    """沿 x 方向的墙，带门洞与门楣。"""
    segs = []
    if x0 < open_x0:
        segs.append((x0, open_x0))
    if open_x1 < x1:
        segs.append((open_x1, x1))
    for i, (a, b) in enumerate(segs):
        box(f"{name}_{i}", a, b, y0, y1, 0.0, WALL_H, M_WALL)
    box(f"{name}_lintel", open_x0, open_x1, y0, y1, 2.3, WALL_H, M_WALL)


wall_with_opening("Wall_S", -WALL_T, W + WALL_T, -WALL_T, 0.0, DOOR_X0, DOOR_X1)
wall_with_opening("Wall_N", -WALL_T, W + WALL_T, D, D + WALL_T, BACK_X0, BACK_X1)
box("Wall_W", -WALL_T, 0.0, -WALL_T, D + WALL_T, 0.0, WALL_H, M_WALL)
box("Wall_E", W, W + WALL_T, -WALL_T, D + WALL_T, 0.0, WALL_H, M_WALL)

# 入口玻璃门（两扇；内缘与中梃由门中点 MX 推导，S8：门中轴与主通道中轴重合）
box("DoorGlass_L", DOOR_X0 + 0.05, MX - 0.10, -0.13, -0.03, 0.1, 2.25, M_GLASS)
box("DoorGlass_R", MX + 0.10, DOOR_X1 - 0.05, -0.13, -0.03, 0.1, 2.25, M_GLASS)
box("DoorFrame_L", DOOR_X0 + 0.02, DOOR_X0 + 0.08, -0.14, -0.02, 0.0, 2.3, M_DARK)
box("DoorFrame_R", DOOR_X1 - 0.08, DOOR_X1 - 0.02, -0.14, -0.02, 0.0, 2.3, M_DARK)
box("DoorMullion", MX - 0.10, MX + 0.10, -0.14, -0.02, 0.0, 2.3, M_DARK)

# ---------------- 货架通道：6 组背靠背货架岛 × 12 条通道 ----------------
aisles_between = [AISLE, AISLE, MAIN, AISLE, AISLE]
x = PERIM_W
blocks = []
for i in range(6):
    bx0 = x
    bx1 = x + 2 * RUN_W
    blocks.append((bx0, bx1))
    x = bx1 + (aisles_between[i] if i < 5 else 0)
EAST_PERIM = W - x  # 东侧沿墙通道（约 1.9 m，服务台所在）
print("blocks:", [(round(a, 2), round(b, 2)) for a, b in blocks], "east_perim:", round(EAST_PERIM, 2))

run_objs_all = []
for block_idx, (bx0, bx1) in enumerate(blocks):
    for half in (0, 1):
        idx = block_idx * 2 + half
        rid, cat = RUNS[idx]
        cname = CATS[cat]["name"]
        x0 = bx0 + half * RUN_W
        x1 = x0 + RUN_W
        xc = (x0 + x1) / 2
        objs = []

        objs.append(box(f"RUN_{rid}_plinth", x0, x1, RUN_Y0, RUN_Y1, 0.0, 0.12, M_DARK, col="Runs"))
        objs.append(box(f"RUN_{rid}_spine", xc - 0.04, xc + 0.04, RUN_Y0, RUN_Y1, 0.12, 1.78, M_METAL, col="Runs"))
        # 两侧层板（4 层；顶层板用淡品类色，俯视透出绿/橙/红/蓝四段——S3b）
        for z in (0.35, 0.75, 1.15, 1.75):
            board_mat = CAT_BOARD_MATS[cat] if z > 1.7 else M_BOARD
            objs.append(box(f"RUN_{rid}_boardW_{z}", x0 + 0.08, xc - 0.04, RUN_Y0 + 0.06, RUN_Y1 - 0.06, z, z + 0.035, board_mat, col="Runs"))
            objs.append(box(f"RUN_{rid}_boardE_{z}", xc + 0.04, x1 - 0.08, RUN_Y0 + 0.06, RUN_Y1 - 0.06, z, z + 0.035, board_mat, col="Runs"))
            # 层板前沿深色前挡条（S7b，12 run × 2 侧 × 4 层）
            objs.append(box(f"RUN_{rid}_railW_{z}", x0 + 0.045, x0 + 0.085, RUN_Y0 + 0.06, RUN_Y1 - 0.06, z + 0.035, z + 0.075, M_DARK, col="Runs"))
            objs.append(box(f"RUN_{rid}_railE_{z}", x1 - 0.085, x1 - 0.045, RUN_Y0 + 0.06, RUN_Y1 - 0.06, z + 0.035, z + 0.075, M_DARK, col="Runs"))
            # 白色 ESL 电子价签（S7b：只做 3 条中低层板，控制对象量 12×2×3）
            if z < 1.7:
                for yi, yy in enumerate((5.5, 9.5, 13.5)):
                    objs.append(box(f"RUN_{rid}_eslW_{z}_{yi}", x0 + 0.09, x0 + 0.16, yy - 0.12, yy + 0.12, z + 0.035, z + 0.085, M_WHITE, col="Runs"))
                    objs.append(box(f"RUN_{rid}_eslE_{z}_{yi}", x1 - 0.16, x1 - 0.09, yy - 0.12, yy + 0.12, z + 0.035, z + 0.085, M_WHITE, col="Runs"))
        # 南北端头板（品类色，用于快速识别）
        objs.append(box(f"RUN_{rid}_capS", x0, x1, RUN_Y0, RUN_Y0 + 0.05, 0.12, 1.85, CAT_MATS[cat], col="Runs"))
        objs.append(box(f"RUN_{rid}_capN", x0, x1, RUN_Y1 - 0.05, RUN_Y1, 0.12, 1.85, CAT_MATS[cat], col="Runs"))
        # 商品陈列（每侧 3 层 × 3 段，示意色块）
        seg_len = (RUN_Y1 - RUN_Y0 - 0.5 - 0.3) / 3
        for side, gx0, gx1 in (("W", x0 + 0.18, x0 + 0.42), ("E", x1 - 0.42, x1 - 0.18)):
            for li, z in enumerate((0.385, 0.785, 1.185)):
                for ri in range(3):
                    gy0 = RUN_Y0 + 0.25 + ri * (seg_len + 0.15)
                    mat = GOODS_MATS[cat][(li + ri) % 3]
                    objs.append(box(f"RUN_{rid}_goods{side}_{li}_{ri}", gx0, gx1, gy0, gy0 + seg_len, z, z + 0.24, mat, col="Runs"))

        # 数字孪生属性：选中任意部件可查看 run_id / category_id / category_name
        for ob in objs:
            ob["run_id"] = rid
            ob["category_id"] = f"cat_{cat}"
            ob["category_name"] = cname
        run_objs_all.extend(objs)

        # 通道南端悬挂标牌：R01 蔬菜（板宽 1.05：同岛相邻吊牌中心距 1.1 m，留 0.05 m 缝防共面闪面——S3e）
        y_sign = RUN_Y0 - 0.35
        box(f"Sign_{rid}_board", xc - 0.525, xc + 0.525, y_sign - 0.02, y_sign + 0.02, SIGN_H, SIGN_H + 0.42, CAT_MATS[cat])
        text(f"Sign_{rid}_text", f"{rid} {cname}", 0.22, M_TEXT_W, (xc, y_sign - 0.035, SIGN_H + 0.21), rx=math.pi / 2)
        box(f"Sign_{rid}_rod", xc - 0.015, xc + 0.015, y_sign - 0.015, y_sign + 0.015, SIGN_H + 0.42, 2.9, M_DARK)

        # 通道北端镜像吊牌（S6c：rz=pi 朝北；已核验与 C3/C4 新柱位、周转筐均无碰）
        y_sign_n = RUN_Y1 + 0.35
        box(f"Sign_{rid}_boardN", xc - 0.525, xc + 0.525, y_sign_n - 0.02, y_sign_n + 0.02, SIGN_H, SIGN_H + 0.42, CAT_MATS[cat])
        text(f"Sign_{rid}_textN", f"{rid} {cname}", 0.22, M_TEXT_W, (xc, y_sign_n + 0.035, SIGN_H + 0.21), rx=math.pi / 2, rz=math.pi)
        box(f"Sign_{rid}_rodN", xc - 0.015, xc + 0.015, y_sign_n - 0.015, y_sign_n + 0.015, SIGN_H + 0.42, 2.9, M_DARK)

        # 顶视编号（S3a：顶层板顶 1.785、脊柱顶 1.78，1.81 悬空无碰；俯视图由此可读 R01–R12）
        text(f"Label_{rid}", f"{rid} {cname}", 0.18, M_TEXT, (xc, 9.5, 1.81), rx=0)

# 品类分区地面色带：每品类一条连续色带（S3c：边界 5.6/17.4 恰落在品类分界 run 线上，跨品类面对为零；
# 逐 run 外扩会在 6 条次通道各产生 1.4 m 双色共面叠压，故不再逐 run 铺带；11.0–12.0 灰底留给主通道地面文字）
for _ck, _a, _b in (("veg", 0.2, 5.6), ("fruit", 5.6, 11.0), ("meat", 12.0, 17.4), ("seafood", 17.4, 22.8)):
    box(f"ZoneFloor_{_ck}", _a, _b, RUN_Y0 - 0.15, RUN_Y1 + 0.15, 0.002, 0.006, CAT_FLOOR_MATS[_ck])

# 主通道上方总标识（合成数据标记，SPEC §7.2）
mx = MX  # S8：由门中点常量推导，自动跟随门位
box("Sign_Main_board", mx - 2.0, mx + 2.0, 3.95, 4.05, 2.55, 3.1, M_SLATE)
text("Sign_Main_text", "模拟永辉生鲜区 · 合成数据规划孪生", 0.24, M_TEXT_W, (mx, 3.93, 2.83), rx=math.pi / 2)
text("Sign_Main_text_back", "YH TwinOps · Synthetic Data", 0.18, M_TEXT_W, (mx, 4.07, 2.83), rx=math.pi / 2, rz=math.pi)
box("Sign_Entrance_plate", mx - 0.6, mx + 0.6, -0.17, -0.04, 2.3, 2.9, M_SLATE)
text("Sign_Entrance", "入口", 0.3, M_TEXT_W, (mx, -0.19, 2.6), rx=math.pi / 2)

# ---------------- 结构柱（调改时不可移动的约束要素） ----------------
# S1：柱心从 (9.8/12.7, 4.9/14.1) 移至主通道两缘并内收 3 cm——贴齐位 (10.55/12.45) 与 R06/R07 的
# bbox 间隙仅 ±1e-15 m，共面渲染有闪面风险；新位与全部 Run/Fixtures/Signage 零冲突（render 前有断言），
# 柱-货架让位间隙 0.03 m，柱间净宽 12.17-10.83 = 1.34 m ≥ minPassageWidthM(1.2)：柱不可移、通道被挤但仍合规
for cx, cy, cn in ((10.58, 5.5, "C1"), (12.42, 5.5, "C2"), (10.58, 13.5, "C3"), (12.42, 13.5, "C4")):
    box(f"Column_{cn}", cx - 0.25, cx + 0.25, cy - 0.25, cy + 0.25, 0.0, 3.2, M_COL)
    text(f"Label_{cn}", cn, 0.2, M_TEXT, (cx, cy, 3.21), rx=0)  # S6a 柱顶平贴编号（柱高 3.2，字底 3.206 悬空无碰）

# ---------------- 南区促销堆头与购物篮 ----------------
# S7a：堆头不再空箱——箱口以上两层商品堆（实心箱体 0–0.9 会吞掉 0.85 以下的货物，故自 0.9 起）+ 黄色 POP 竖牌插箱角
PROMO_CATS = ("veg", "fruit", "meat", "seafood")
for i, bx in enumerate((3.7, 6.2, 16.4, 19.0)):
    _pc = PROMO_CATS[i]
    box(f"PromoBin_{i + 1}", bx - 0.6, bx + 0.6, 1.7, 2.5, 0.0, 0.9, M_WOOD, col="Fixtures")
    box(f"PromoGoods_{i + 1}_a", bx - 0.48, bx + 0.48, 1.76, 2.44, 0.9, 1.14, GOODS_MATS[_pc][0], col="Fixtures")
    box(f"PromoGoods_{i + 1}_b", bx - 0.3, bx + 0.3, 1.86, 2.34, 1.14, 1.25, GOODS_MATS[_pc][1], col="Fixtures")
    box(f"PromoPOP_{i + 1}", bx + 0.26, bx + 0.61, 1.715, 1.745, 0.9, 1.18, M_POP, col="Fixtures")
    text(f"PromoPOP_{i + 1}_text", "特价", 0.12, M_TEXT, (bx + 0.435, 1.7, 1.04), rx=math.pi / 2)
# S7d：购物篮堆移到入口旁（原东南角 22.2–22.8 让给比例尺；避开门槛 y≤0.55 与图例 x≤8.0）
box("BasketStack", 8.4, 9.2, 0.6, 1.2, 0.0, 0.9, M_SERVICE, col="Fixtures")
# S7d：自助称重台一对，布置在主通道口两缘（9.7 / 13.3，与 S1 新柱位、R05 南端、促销堆头均无碰）
for i, sx in enumerate((9.7, 13.3)):
    box(f"SelfCheck_{i + 1}_body", sx - 0.25, sx + 0.25, 3.05, 3.65, 0.0, 0.9, M_WHITE, col="Fixtures")
    box(f"SelfCheck_{i + 1}_screen", sx - 0.15, sx + 0.15, 3.52, 3.58, 0.9, 1.3, M_SLATE, col="Fixtures")
    box(f"SelfCheck_{i + 1}_sticker", sx - 0.4, sx + 0.4, 2.55, 2.95, 0.003, 0.011, M_SIGN_GREEN, col="Fixtures")
    text(f"SelfCheck_{i + 1}_sticker_text", "自助称重", 0.16, M_TEXT_W, (sx, 2.75, 0.02), rx=0)

# ---------------- 北侧：风幕柜 / 加工台 / 服务台 / 后仓周转 ----------------
NORTH_Y0, NORTH_Y1 = 16.45, 17.85
# S2：设备按品类西→东重排，x 区间对齐品类 run 跨度（蔬菜 0.9–5.6 / 水果 5.6–10.3 / 肉品 12.7–17.4 /
# 水产 17.4–22.1），每台设备只面对本品类 run、跨品类面对为零；R12(21.0–22.1) 前是后仓门（21.0–22.8）
# 无法布设备，靠北端吊牌识别。水产冰台止步 20.8 以避开门洞。
coolers = (("Cooler_veg", "蔬菜风幕柜", 1.0, 5.6, "veg"), ("Cooler_fruit", "果切冷链柜", 5.9, 10.9, "fruit"))
for name, label, a, b, cat in coolers:
    box(f"{name}_body", a, b, NORTH_Y0 + 0.05, NORTH_Y1, 0.0, 2.0, M_WHITE, col="Fixtures")
    box(f"{name}_glass", a + 0.1, b - 0.1, NORTH_Y0, NORTH_Y0 + 0.06, 0.1, 1.9, M_GLASS, col="Fixtures")
    for z in (0.55, 1.15, 1.7):
        box(f"{name}_goods_{z}", a + 0.3, b - 0.3, NORTH_Y0 + 0.25, NORTH_Y0 + 0.7, z, z + 0.22, GOODS_MATS[cat][1], col="Fixtures")
    box(f"Sign_{name}_plate", (a + b) / 2 - 0.8, (a + b) / 2 + 0.8, NORTH_Y0 - 0.06, NORTH_Y0 - 0.02, 1.45, 1.85, CAT_MATS[cat])
    text(f"Sign_{name}_text", label, 0.16, M_TEXT_W, ((a + b) / 2, NORTH_Y0 - 0.08, 1.65), rx=math.pi / 2)
    # S6b：柜顶平贴字（z 2.01，字底 2.006 悬空于柜顶 2.0 之上）+ 正面品类色带（打破白柜贴浅灰墙、俯视无字白块）
    text(f"Label_{name}", label, 0.2, M_TEXT, ((a + b) / 2, (NORTH_Y0 + NORTH_Y1) / 2, 2.01), rx=0)
    box(f"{name}_band", a + 0.05, b - 0.05, NORTH_Y0 + 0.035, NORTH_Y0 + 0.055, 1.92, 1.99, CAT_MATS[cat], col="Fixtures")

counters = (("Counter_meat", "肉品加工", 12.7, 17.4, "meat"), ("Counter_sea", "水产冰台", 17.7, 20.8, "seafood"))
for name, label, a, b, cat in counters:
    box(f"{name}_body", a, b, NORTH_Y0 + 0.1, NORTH_Y1 - 0.1, 0.0, 0.85, CAT_SOFT_MATS[cat], col="Fixtures")
    box(f"{name}_top", a - 0.05, b + 0.05, NORTH_Y0 + 0.05, NORTH_Y1 - 0.05, 0.85, 0.9, M_WHITE, col="Fixtures")
    text(f"Sign_{name}_text", label, 0.26, M_TEXT, ((a + b) / 2, (NORTH_Y0 + NORTH_Y1) / 2, 0.915))  # 抬至 0.915 让位冰面
    # S7c：台面填充——水产冰台铺微蓝白冰面（与台面留 2 mm 让位防共面闪面）+ 深色托盘；肉品台粉红托盘阵列
    if name == "Counter_sea":
        box(f"{name}_ice", a, b, NORTH_Y0 + 0.1, NORTH_Y1 - 0.1, 0.902, 0.907, M_ICE, col="Fixtures")
        for ti, (tx, ty) in enumerate(((18.0, 16.8), (18.55, 16.8), (19.95, 16.8), (18.2, 17.5), (19.6, 17.5))):
            box(f"{name}_tray_{ti}", tx - 0.225, tx + 0.225, ty - 0.15, ty + 0.15, 0.907, 0.967, M_SLATE, col="Fixtures")
    else:
        for ti, (tx, ty) in enumerate(((13.1, 16.8), (13.7, 16.8), (14.3, 16.8), (13.4, 17.5), (14.05, 17.5), (16.1, 16.8), (16.75, 16.8))):
            box(f"{name}_tray_{ti}", tx - 0.225, tx + 0.225, ty - 0.15, ty + 0.15, 0.902, 0.962, M_TRAY_MEAT, col="Fixtures")
    # S7c：前倾防尘玻璃罩（复用 M_GLASS；box() 以世界坐标建模，须先把网格平移到以几何中心为原点再旋转）
    cover = box(f"{name}_cover", a + 0.02, b - 0.02, NORTH_Y0 + 0.03, NORTH_Y0 + 0.06, 0.9, 1.4, M_GLASS, col="Fixtures")
    _pivot = Vector(((a + b) / 2, NORTH_Y0 + 0.045, 1.15))
    cover.data.transform(Matrix.Translation(-_pivot))
    cover.location = _pivot
    cover.rotation_euler = (math.radians(12), 0, 0)  # 顶边向南（顾客侧）前倾 12°

# 服务台（东侧沿墙；台前净距 22.1→23.2 = 1.1 m，与西侧沿墙 0.9 m 同为员工作业通道，不计入 minPassageWidthM——S5）
box("Counter_service_body", 23.2, 23.9, 1.6, 5.0, 0.0, 1.05, M_SERVICE, col="Fixtures")
box("Counter_service_top", 23.15, 23.95, 1.55, 5.05, 1.05, 1.1, M_WHITE, col="Fixtures")
text("Sign_service_text", "服务台", 0.24, M_TEXT, (23.55, 3.3, 1.11))
# 后仓周转筐
box("Crate_1", 22.2, 22.75, 14.85, 15.4, 0.0, 0.45, M_CRATE, col="Fixtures")
box("Crate_2", 22.2, 22.75, 15.5, 16.05, 0.0, 0.45, M_CRATE, col="Fixtures")

# ---------------- 地面文字（通道宽度可视 = 业务约束可视化） ----------------
text("FloorText_Main", "主通道 2.4 m", 0.5, M_TEXT, (mx, 9.5, 0.02))  # S4：0.4→0.5，字宽约 2.3 m 仍在 2.4 m 通道内
for i, (ax0, ax1) in enumerate(((blocks[0][1], blocks[1][0]), (blocks[1][1], blocks[2][0]),
                                (blocks[3][1], blocks[4][0]), (blocks[4][1], blocks[5][0]))):
    text(f"FloorText_Aisle{i + 1}", f"{AISLE} m", 0.24, M_TEXT, ((ax0 + ax1) / 2, 9.5, 0.02))
text("FloorText_Back", "后仓", 0.28, M_TEXT, ((BACK_X0 + BACK_X1) / 2, 16.9, 0.02))
text("FloorText_Checkout", "→ 至收银区", 0.26, M_TEXT, (22.9, 7.5, 0.02))
text("FloorText_Promo", "促销堆头", 0.2, M_TEXT, (16.4, 1.15, 0.02), rx=0)  # S6d 促销堆头地面点名

# S3d：品类图例（南区平贴，x 2.2–8.0，避开入口旁篮堆 8.4–9.2 与门槛 y≤0.55）
for i, (ck, cv) in enumerate(CATS.items()):
    lx = 2.2 + i * 1.45
    box(f"Legend_{ck}", lx, lx + 0.55, 0.85, 1.35, 0.004, 0.014, CAT_MATS[ck])
    text(f"Legend_{ck}_text", cv["name"], 0.2, M_TEXT, (lx + 0.85, 1.1, 0.02), rx=0)

# S3f：东南角 2 m 比例尺（双段，替代原篮堆位置）+ 西北角指北（避开新蔬菜柜 x≥1.0）
box("ScaleBar_a", 19.0, 20.0, 0.95, 1.05, 0.002, 0.012, M_DARK)
box("ScaleBar_b", 20.0, 21.0, 0.95, 1.05, 0.002, 0.012, M_WHITE)
text("ScaleBar_0", "0", 0.14, M_TEXT, (19.0, 0.78, 0.02), rx=0)
text("ScaleBar_1", "1", 0.14, M_TEXT, (20.0, 0.78, 0.02), rx=0)
text("ScaleBar_2", "2 m", 0.14, M_TEXT, (21.0, 0.78, 0.02), rx=0)
text("FloorText_North", "N ↑", 0.22, M_TEXT, (0.45, 17.2, 0.02), rx=0)  # 落实"北朝上"到图面

# ---------------- 灯光（S4 曝光修正；energy/背景为"重渲后微调"两值，按预览画面 ±0.4 定稿） ----------------
sun = bpy.data.lights.new("Sun", type="SUN")
sun.energy = 2.8      # S4：4.2→2.8，Standard 变换 + 0.72–0.93 高明度材质整体趋白，压能量防"主通道 2.4 m"晒白
sun.angle = math.radians(11)  # S4：6°→11° 柔化影缘（配合 taa 96 消除条带）
sun_ob = bpy.data.objects.new("Sun", sun)
sun_ob.rotation_euler = (math.radians(45), 0, math.radians(205))  # S4：入射仰角 20°→45°，1.785 m 货架落影 4.90 m→1.79 m
COLS["Architecture"].objects.link(sun_ob)

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.55, 0.58, 0.62, 1)  # S4：压深背景衬出白模轮廓
bg.inputs["Strength"].default_value = 0.58

# ---------------- 相机与渲染 ----------------

def add_cam(name, loc, lens=45.0, target=None, ortho=None):
    cd = bpy.data.cameras.new(name)
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    else:
        cd.lens = lens
    ob = bpy.data.objects.new(name, cd)
    ob.location = loc
    if target:
        d = Vector(target) - Vector(loc)
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    COLS["Architecture"].objects.link(ob)
    return ob


cam_top = add_cam("CAM_TOP", (W / 2, D / 2, 30.0), ortho=26.0)  # 俯视平面图：北朝上
cam_iso = add_cam("CAM_ISO", (34.0, -16.0, 19.0), lens=45.0, target=(W / 2, D / 2 - 1.0, 0.5))

try:
    scene.eevee.taa_render_samples = 96  # S4：32→96，消除影缘条带（耗时约 ×3，可接受）
except Exception:
    pass
scene.render.image_settings.file_format = "PNG"


# ---------------- S1 断言：结构柱不得与货架/设施/标牌体量相交（容差 1e-4 防浮点误报） ----------------
# 品类地面色带等 Architecture 集合对象按设计垫底，不参与断言。
EPS_AABB = 1e-4

def _aabb(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return (min(p.x for p in pts), max(p.x for p in pts),
            min(p.y for p in pts), max(p.y for p in pts),
            min(p.z for p in pts), max(p.z for p in pts))


_columns = [ob for ob in bpy.data.objects if ob.name.startswith("Column_")]
_col_names = {c.name for c in _columns}
_others = [ob for ob in bpy.data.objects
           if ob.name not in _col_names
           and any(c.name in ("Runs", "Fixtures", "Signage") for c in ob.users_collection)]
_conflicts = []
for _c in _columns:
    _ca = _aabb(_c)
    for _ob in _others:
        _cb = _aabb(_ob)
        _ox = min(_ca[1], _cb[1]) - max(_ca[0], _cb[0])
        _oy = min(_ca[3], _cb[3]) - max(_ca[2], _cb[2])
        _oz = min(_ca[5], _cb[5]) - max(_ca[4], _cb[4])
        if _ox > EPS_AABB and _oy > EPS_AABB and _oz > EPS_AABB:
            _conflicts.append((_c.name, _ob.name, round(_ox, 4), round(_oy, 4), round(_oz, 4)))
print("S1 column-conflict check:", "OK (0 conflicts)" if not _conflicts else _conflicts)
assert not _conflicts, f"结构柱与货架/设施/标牌相交: {_conflicts}"

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print("SAVED:", BLEND)


def render_to(path, cam, res_x, res_y, shadows=True):
    # 俯视图关闭太阳阴影，保证平面图可读（Blender 5.x 属性为 use_shadow）
    sun.use_shadow = shadows
    scene.camera = cam
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDERED:", path)


render_to(TOP_PNG, cam_top, 1920, 1440, shadows=False)
render_to(ISO_PNG, cam_iso, 1920, 1080, shadows=True)

with open(DONE, "w", encoding="utf-8") as f:
    f.write(f"done {datetime.now().isoformat()} blend={BLEND}\n")
print("ALL DONE")
