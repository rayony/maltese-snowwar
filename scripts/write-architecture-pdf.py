#!/usr/bin/env python3
"""Maltese Snow War — architecture & P2P smoothness briefing (PDF)."""

from reportlab.lib.colors import Color, HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
    Flowable,
    Image,
)
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage

try:
    pdfmetrics.registerFont(TTFont("Noto", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", subfontIndex=0))
except Exception:
    pdfmetrics.registerFont(TTFont("Noto", "/usr/share/fonts/opentype/unifont/unifont.otf"))
CJK = "Noto"
pdfmetrics.registerFont(TTFont("Caveat", "/workspace/public/fonts/Caveat-Bold.ttf"))

OUT = "/workspace/artifacts/Maltese-Snow-War-Architecture.pdf"

INK = HexColor("#15202B")
PINE = HexColor("#1F4D3A")
ICE = HexColor("#8EC8C8")
SNOW = HexColor("#FFFDF8")
ZEBRA = HexColor("#DCE8E0")
HEAD_BG = HexColor("#102018")
BARK = HexColor("#6B4A2B")
FLAME = HexColor("#C23B22")
SKY = HexColor("#2F6FED")
MUTED = HexColor("#3A424A")
LINE = HexColor("#9AA79C")
PAPER = HexColor("#FFFFFF")

SHOT = {
    "title": "/workspace/artifacts/pdf-art/title-clean.png",
    "throw": "/workspace/artifacts/pdf-art/strip-throw.png",
    "pack": "/workspace/artifacts/pdf-art/strip-pack.png",
    "maltese": "/workspace/artifacts/pdf-art/zoom-maltese.png",
    "retriever": "/workspace/artifacts/pdf-art/zoom-retriever.png",
    "lobby": "/workspace/artifacts/pdf-art/lobby-qr.png",
    "host": "/workspace/artifacts/pdf-art/host-clean.png",
    "guest": "/workspace/artifacts/pdf-art/guest-clean.png",
    "countdown": "/workspace/artifacts/pdf-art/countdown.png",
    "cover": "/workspace/screenshots/feat-cover.png",
    "og": "/workspace/public/og.jpg",
}


def fit_image(path, max_w, max_h):
    im = PILImage.open(path)
    w, h = im.size
    scale = min(max_w / w, max_h / h)
    return Image(path, width=w * scale, height=h * scale)


def captioned(path, caption, note_style, max_w=170 * mm, max_h=58 * mm):
    img = fit_image(path, max_w, max_h)
    cap = Paragraph(caption, note_style)
    return KeepTogether([img, Spacer(1, 1.2 * mm), cap, Spacer(1, 3 * mm)])


def pair_shots(p1, c1, p2, c2, note_style, max_h=48 * mm):
    w = 78 * mm
    i1 = fit_image(p1, w, max_h)
    i2 = fit_image(p2, w, max_h)
    cap1 = Paragraph(c1, note_style)
    cap2 = Paragraph(c2, note_style)
    t = Table([[i1, i2], [cap1, cap2]], colWidths=[w + 10 * mm, w + 10 * mm])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (1, 0), 4),
                ("BOTTOMPADDING", (0, 0), (1, 0), 6),
                ("TOPPADDING", (0, 1), (1, 1), 4),
                ("BOTTOMPADDING", (0, 1), (1, 1), 6),
            ]
        )
    )
    return KeepTogether([t, Spacer(1, 4 * mm)])


def contrast_table(data, col_widths):
    """Dark header + white/cream body. Paragraph colors carry the type color."""
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("BACKGROUND", (0, 1), (-1, -1), PAPER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.6, HexColor("#1A2A20")),
        ("BOX", (0, 0), (-1, -1), 0.9, HEAD_BG),
    ]
    for r in range(2, len(data), 2):
        style.append(("BACKGROUND", (0, r), (-1, r), ZEBRA))
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle(style))
    return t


class BoxFlow(Flowable):
    def __init__(self, rows, width=170 * mm, row_h=11 * mm):
        super().__init__()
        self.rows = rows
        self.box_w = width
        self.row_h = row_h
        self.height = len(rows) * (row_h + 4 * mm) + 4 * mm
        self.width = width

    def draw(self):
        c = self.canv
        y = self.height - 2 * mm
        for label, sub, fill in self.rows:
            y -= self.row_h
            c.setFillColor(fill)
            c.roundRect(0, y, self.box_w, self.row_h, 4, fill=1, stroke=0)
            c.setFillColor(white)
            c.setFont("Times-Bold", 10)
            c.drawString(8, y + self.row_h - 12, label)
            c.setFillColor(HexColor("#F4FFF8"))
            c.setFont("Times-Roman", 8)
            c.drawString(8, y + 4, sub)
            y -= 4 * mm


class ArrowFlow(Flowable):
    def __init__(self, text, width=170 * mm):
        super().__init__()
        self.text = text
        self.width = width
        self.height = 8 * mm

    def draw(self):
        c = self.canv
        c.setStrokeColor(PINE)
        c.setFillColor(PINE)
        c.setLineWidth(1.2)
        mid = self.width / 2
        c.line(mid, self.height - 1, mid, 4)
        c.drawCentredString(mid, self.height - 2, "")
        path = c.beginPath()
        path.moveTo(mid, 0)
        path.lineTo(mid - 4, 5)
        path.lineTo(mid + 4, 5)
        path.close()
        c.drawPath(path, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont("Times-Italic", 8)
        c.drawCentredString(mid + 42, 3, self.text)


class HFlow(Flowable):
    """Horizontal boxes with arrows — simple pipeline."""

    def __init__(self, labels, width=170 * mm, height=22 * mm):
        super().__init__()
        self.labels = labels
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        n = len(self.labels)
        gap = 8
        box_w = (self.width - gap * (n - 1)) / n
        h = 16 * mm
        y = 3 * mm
        for i, lab in enumerate(self.labels):
            x = i * (box_w + gap)
            c.setFillColor(PINE if i % 2 == 0 else INK)
            c.roundRect(x, y, box_w, h, 3, fill=1, stroke=0)
            c.setFillColor(white)
            c.setFont("Times-Bold", 7.5)
            # wrap
            words = lab.split()
            line1, line2 = lab, ""
            if len(lab) > 16 and len(words) > 1:
                midw = max(1, len(words) // 2)
                line1 = " ".join(words[:midw])
                line2 = " ".join(words[midw:])
            if line2:
                c.drawCentredString(x + box_w / 2, y + 10, line1)
                c.drawCentredString(x + box_w / 2, y + 3, line2)
            else:
                c.drawCentredString(x + box_w / 2, y + 6, lab)
            if i < n - 1:
                ax = x + box_w + 1
                c.setFillColor(BARK)
                c.setStrokeColor(BARK)
                c.line(ax, y + h / 2, ax + gap - 2, y + h / 2)
                path = c.beginPath()
                path.moveTo(ax + gap - 1, y + h / 2)
                path.lineTo(ax + gap - 6, y + h / 2 + 3)
                path.lineTo(ax + gap - 6, y + h / 2 - 3)
                path.close()
                c.drawPath(path, fill=1, stroke=0)


class SeqDiag(Flowable):
    """Two-actor sequence diagram in the mermaid sequenceDiagram style."""

    def __init__(self, actors, events, width=170 * mm, caption=""):
        super().__init__()
        self.actors = actors  # two labels
        self.events = events  # ('self', i, text) | ('msg', src, dst, text, dashed?)
        self.width = width
        self.caption = caption
        self.box_h = 11 * mm
        self.row = 11 * mm
        self.cap_h = 6 * mm if caption else 0
        n = len(events)
        self.height = self.box_h * 2 + 8 * mm + n * self.row + self.cap_h

    def draw(self):
        c = self.canv
        w = self.width
        col = [w * 0.28, w * 0.72]
        box_w = 42 * mm
        top = self.height - self.cap_h - 1 * mm
        if self.caption:
            c.setFillColor(MUTED)
            c.setFont(CJK, 8)
            c.drawString(2, self.height - 5 * mm, self.caption)

        def actor_box(i, y):
            x = col[i] - box_w / 2
            c.setFillColor(HexColor("#F2F2F2"))
            c.setStrokeColor(HexColor("#C8C8C8"))
            c.setLineWidth(0.7)
            c.roundRect(x, y - self.box_h, box_w, self.box_h, 3, fill=1, stroke=1)
            c.setFillColor(INK)
            c.setFont(CJK, 8)
            c.drawCentredString(col[i], y - self.box_h + 4, self.actors[i])

        actor_box(0, top)
        actor_box(1, top)
        y_life_top = top - self.box_h
        y_life_bot = self.box_h + 2 * mm
        c.setStrokeColor(HexColor("#B0B0B0"))
        c.setDash(1, 2)
        c.setLineWidth(0.8)
        c.line(col[0], y_life_top, col[0], y_life_bot)
        c.line(col[1], y_life_top, col[1], y_life_bot)
        c.setDash()
        actor_box(0, self.box_h)
        actor_box(1, self.box_h)

        y = y_life_top - 4 * mm
        for ev in self.events:
            y -= self.row
            kind = ev[0]
            if kind == "self":
                i, text = ev[1], ev[2]
                x = col[i]
                c.setStrokeColor(INK)
                c.setFillColor(INK)
                c.setLineWidth(1)
                c.line(x, y + 6, x + 22 * mm, y + 6)
                c.line(x + 22 * mm, y + 6, x + 22 * mm, y - 2)
                c.line(x + 22 * mm, y - 2, x, y - 2)
                path = c.beginPath()
                path.moveTo(x, y - 2)
                path.lineTo(x + 4, y + 2)
                path.lineTo(x + 4, y - 6)
                path.close()
                c.drawPath(path, fill=1, stroke=0)
                c.setFont(CJK, 7.5)
                c.drawString(x + 3 * mm, y + 8, text)
            elif kind == "msg":
                src, dst, text = ev[1], ev[2], ev[3]
                dashed = len(ev) > 4 and ev[4]
                x0, x1 = col[src], col[dst]
                c.setStrokeColor(INK)
                c.setFillColor(INK)
                c.setLineWidth(1)
                if dashed:
                    c.setDash(2, 2)
                c.line(x0, y, x1, y)
                c.setDash()
                dirn = 1 if x1 > x0 else -1
                path = c.beginPath()
                path.moveTo(x1, y)
                path.lineTo(x1 - 6 * dirn, y + 3.5)
                path.lineTo(x1 - 6 * dirn, y - 3.5)
                path.close()
                c.drawPath(path, fill=1, stroke=0)
                c.setFont(CJK, 7.5)
                c.setFillColor(INK)
                c.drawCentredString((x0 + x1) / 2, y + 4, text)


def header_footer(canv, doc):
    canv.saveState()
    canv.setFillColor(INK)
    canv.rect(0, A4[1] - 14 * mm, A4[0], 14 * mm, fill=1, stroke=0)
    canv.setFillColor(ICE)
    canv.setFont("Times-Bold", 8)
    canv.drawString(18 * mm, A4[1] - 9 * mm, "MALTESE SNOW WAR")
    canv.setFillColor(SNOW)
    canv.setFont("Times-Roman", 8)
    canv.drawRightString(A4[0] - 18 * mm, A4[1] - 9 * mm, "Architecture briefing")
    canv.setFillColor(LINE)
    canv.rect(0, 0, A4[0], 12 * mm, fill=1, stroke=0)
    canv.setFillColor(MUTED)
    canv.setFont("Times-Roman", 8)
    canv.drawString(18 * mm, 5 * mm, "Fan remake · not affiliated with Nicholson NY or moonlab")
    canv.drawRightString(A4[0] - 18 * mm, 5 * mm, f"{doc.page}")
    canv.restoreState()


def cover_page(canv, doc):
    if doc.page != 1:
        header_footer(canv, doc)
        return
    canv.saveState()
    canv.setFillColor(INK)
    canv.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canv.setFillColor(PINE)
    canv.rect(0, A4[1] - 38 * mm, A4[0], 38 * mm, fill=1, stroke=0)
    canv.setFillColor(ICE)
    canv.setFont("Times-Bold", 11)
    canv.drawString(22 * mm, A4[1] - 18 * mm, "PROJECT BRIEFING")
    canv.setFillColor(white)
    canv.setFont("Times-Bold", 28)
    canv.drawString(22 * mm, A4[1] - 58 * mm, "Maltese Snow War")
    canv.setFillColor(HexColor("#FFF3C4"))
    canv.setFont("Caveat", 22)
    canv.drawString(22 * mm, A4[1] - 72 * mm, "Hold, Dodge, and Throw!")
    canv.setFont("Times-Italic", 13)
    canv.setFillColor(ICE)
    canv.drawString(22 * mm, A4[1] - 86 * mm, "Code structure, runtime flow, and P2P smoothness")
    canv.setStrokeColor(ICE)
    canv.setLineWidth(0.6)
    canv.line(22 * mm, A4[1] - 94 * mm, 90 * mm, A4[1] - 94 * mm)
    canv.setFillColor(SNOW)
    canv.setFont("Times-Roman", 11)
    y = A4[1] - 114 * mm
    for line in [
        "A browser remake of the 1998 Flash game SnowCraft,",
        "with moonlab’s Line Puppy dogs: Maltese vs golden retrievers.",
        "Vs AI (Easy / Hard) and 1v1 WebRTC rooms.",
        "",
        "This note maps the repo, the fixed-step game loop,",
        "and every trick used to hide network delay.",
    ]:
        canv.drawString(22 * mm, y, line)
        y -= 16
    canv.setFillColor(MUTED)
    canv.setFont("Times-Roman", 9)
    canv.drawString(22 * mm, 28 * mm, "Internal architecture document  ·  August 2026")
    canv.restoreState()


def build():
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontName="Times-Bold",
        fontSize=16,
        textColor=INK,
        spaceBefore=8,
        spaceAfter=8,
        leading=20,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=12,
        textColor=PINE,
        spaceBefore=10,
        spaceAfter=5,
        leading=16,
    )
    motto = ParagraphStyle(
        "Motto",
        parent=styles["Normal"],
        fontName="Caveat",
        fontSize=18,
        textColor=HexColor("#5A3A10"),
        leading=22,
        spaceAfter=8,
        alignment=TA_LEFT,
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=10,
        textColor=INK,
        leading=14,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )
    note = ParagraphStyle(
        "Note",
        parent=body,
        fontName="Times-Italic",
        textColor=HexColor("#2A3338"),
        fontSize=9,
        leading=13.5,
        alignment=TA_LEFT,
        spaceAfter=2,
        spaceBefore=2,
        leftIndent=1,
        rightIndent=1,
    )
    cell = ParagraphStyle(
        "Cell",
        parent=body,
        fontSize=8.5,
        leading=11.5,
        alignment=TA_LEFT,
        spaceAfter=0,
        textColor=INK,
        fontName="Times-Roman",
    )
    cellb = ParagraphStyle(
        "CellB",
        parent=cell,
        fontName="Times-Bold",
        textColor=INK,
    )
    head = ParagraphStyle(
        "Head",
        parent=cell,
        fontName="Times-Bold",
        textColor=HexColor("#FFFFFF"),
        fontSize=9,
    )

    story = []
    story.append(PageBreak())

    # 1
    story.append(Paragraph("1. What this is", h1))
    story.append(Paragraph("Hold, Dodge, and Throw!", motto))
    story.append(
        Paragraph(
            "Maltese Snow War is a canvas snowball fight in the browser. "
            "Hold a dog to move, release to throw, pack snow between shots. "
            "Vs AI still uses tap-near / hold-far. Versus uses auto-aim plus a fixed range and speed. "
            "White Maltese (red scarves) stand on the right; brown retrievers (party hats) on the left. "
            "The host always plays the Maltese. The guest is mirrored and plays the retrievers. "
            "Two-hit bury, ellipse forts, pack-snow cooldown, and a 3-2-1 countdown before each heat. "
            "It is an unofficial fan tribute to Nicholson NY’s <i>SnowCraft</i> (1998) and moonlab’s Line Puppy illustrations.",
            body,
        )
    )
    story.append(
        Paragraph(
            "Two modes: <b>Play vs AI</b> (Easy / Hard) on one machine, and <b>Play vs Friend</b> "
            "via a 6-letter room code. The host is always the white Maltese (right side). "
            "The guest’s canvas is mirrored so they play the brown retrievers from the right-hand side of their screen. "
            "There is no dedicated game-simulation server — "
            "the host’s browser is the authority; a small signaling server only helps the two "
            "browsers find each other.",
            body,
        )
    )
    story.append(
        pair_shots(
            SHOT["title"],
            "Title card (below, not as a cover overlay): Play vs AI / Play vs Friend.",
            SHOT["host"],
            "Host fight (no countdown overlay): brown retrievers left, white Maltese right. HUD: Maltese.",
            note,
        )
    )

    # 2
    story.append(Paragraph("2. Stack", h1))
    stack = [
        [Paragraph("Layer", head), Paragraph("Choice", head), Paragraph("Why", head)],
        [
            Paragraph("UI shell", cellb),
            Paragraph("React 19 + TanStack Router + Tailwind", cell),
            Paragraph("Title, lobby, pause, credits. Canvas sits underneath.", cell),
        ],
        [
            Paragraph("Game", cellb),
            Paragraph("TypeScript, Canvas 2D, fixed 1/60 s step", cell),
            Paragraph("Deterministic-enough sim; render is a view, not the clock.", cell),
        ],
        [
            Paragraph("Net", cellb),
            Paragraph("WebRTC data channels + HTTP/SSE fallback", cell),
            Paragraph("Peer-to-peer after join. TURN only if NAT blocks UDP.", cell),
        ],
        [
            Paragraph("Host", cellb),
            Paragraph("Vite + Nitro (Vercel preset)", cell),
            Paragraph("SSR title page, <font face='Courier'>/api/rtc</font> signaling.", cell),
        ],
    ]
    story.append(contrast_table(stack, [28 * mm, 62 * mm, 80 * mm]))
    story.append(Spacer(1, 4 * mm))

    # 3
    story.append(Paragraph("3. Repository map", h1))
    story.append(
        Paragraph(
            "Almost all game logic lives under <font face='Courier'>src/game/</font>. "
            "React is a thin chrome around one <font face='Courier'>SnowCraftGame</font> instance.",
            body,
        )
    )
    files = [
        [Paragraph("Path", head), Paragraph("Role", head)],
        [Paragraph("src/components/game/SnowCraft.tsx", cellb), Paragraph("React overlay: title, Easy/Hard, lobby, pause, HUD, QR.", cell)],
        [Paragraph("src/game/game.ts", cellb), Paragraph("Orchestrator: screens, input, audio, net, loop.", cell)],
        [Paragraph("src/game/sim.ts", cellb), Paragraph("Pure world step: throws, collisions, forts, bury.", cell)],
        [Paragraph("src/game/ai.ts", cellb), Paragraph("Bot brains: idle / move / windup / dodge. Easy vs Hard.", cell)],
        [Paragraph("src/game/render.ts", cellb), Paragraph("Canvas paint. Guest view is mirrored.", cell)],
        [Paragraph("src/game/net.ts", cellb), Paragraph("Wire types, pack/apply pose & snapshot.", cell)],
        [Paragraph("src/game/versus-link.ts", cellb), Paragraph("P2P + HTTP bus, seq, ping, clock offset.", cell)],
        [Paragraph("src/game/room-channel.ts", cellb), Paragraph("SSE / poll fallback when WebRTC is down.", cell)],
        [Paragraph("src/lib/multiplayer/p2p.ts", cellb), Paragraph("RTCPeerConnection mesh, ICE, data channels.", cell)],
        [Paragraph("src/lib/multiplayer/signaling.server.ts", cellb), Paragraph("Room roster, ICE servers, TURN from env.", cell)],
        [Paragraph("src/routes/index.tsx", cellb), Paragraph("Landing route (SSR title).", cell)],
        [Paragraph("src/routes/credits.tsx", cellb), Paragraph("Licenses + tribute links.", cell)],
        [Paragraph("src/routes/api/rtc.ts", cellb), Paragraph("Signaling HTTP endpoint.", cell)],
        [Paragraph("src/game/assets.ts / audio.ts", cellb), Paragraph("Sprite hydrate (idle first, poses later) + SFX/BGM.", cell)],
    ]
    story.append(contrast_table(files, [68 * mm, 102 * mm]))

    story.append(Paragraph("3.1 Layer cake", h2))
    story.append(
        BoxFlow(
            [
                ("React chrome  ·  SnowCraft.tsx, routes, credits", "Buttons, lobby, pause — never the physics", INK),
                ("SnowCraftGame  ·  game.ts", "Input, screens, hydrate, versus, audio unlock", PINE),
                ("Simulation  ·  sim.ts + ai.ts", "Fixed timestep. Hits, forts, bots. Authority lives here on the host.", BARK),
                ("Net  ·  versus-link + p2p + /api/rtc", "Poses, throws, hits, over. Signaling is not gameplay.", HexColor("#3D5A80")),
                ("View  ·  render.ts + sprites", "Paint interpolated kids. Guest canvas is mirrored.", HexColor("#1B3A4B")),
            ]
        )
    )
    story.append(Spacer(1, 2 * mm))
    story.append(
        Paragraph(
            "Data flows down: pointer → game.ts → sim (host) or local prediction (guest). "
            "Paint always reads the current <font face='Courier'>GameState</font>. "
            "The guest never decides a bury or a winner.",
            body,
        )
    )

    # 4
    story.append(Paragraph("4. Screen flow", h1))
    story.append(HFlow(["Title", "Load sprites", "3-2-1", "Fight", "Over / rematch"]))
    story.append(Spacer(1, 3 * mm))
    story.append(
        captioned(
            SHOT["countdown"],
            "The only grey band we keep: 3-2-1 (here “PVP mode” + 3). Dogs may walk; packing is locked.",
            note,
            max_h=62 * mm,
        )
    )
    story.append(
        Paragraph(
            "<b>Title</b> is React-only: no sprite preload, no AudioContext, so the first tap is live. "
            "Sprites load only after Easy/Hard, or after both PvP seats are in the room "
            "(<font face='Courier'>packed</font> handshake). "
            "Countdown lets dogs walk but not pack snow. "
            "Vs AI can return to title from pause. "
            "Vs Friend stays in the room on defeat so rematch does not need a new code.",
            body,
        )
    )
    story.append(
        captioned(
            SHOT["pack"],
            "Pack-snow cooldown as a sprite strip (transparent). Four frames: crouch and wind a ball. Not in a fort.",
            note,
            max_h=36 * mm,
        )
    )
    story.append(
        captioned(
            SHOT["throw"],
            "Throw cycle as a sprite strip: wind-up, release, follow-through, then the snowball. Guest predicts this locally.",
            note,
            max_h=36 * mm,
        )
    )

    story.append(Paragraph("4.1 Versus join", h2))
    story.append(HFlow(["Create / Join", "Lobby + QR", "Both packed", "Host start", "Mirrored fight"]))
    story.append(Spacer(1, 2 * mm))
    story.append(
        Paragraph(
            "Host mints a 6-letter code. Guest types it or scans the QR. "
            "Neither side starts the heat until both have finished packing sprites. "
            "Host then sends <font face='Courier'>start</font>. Guest renders the yard flipped "
            "so the retrievers sit on the guest’s right.",
            body,
        )
    )
    story.append(
        captioned(
            SHOT["lobby"],
            "Host invite: 6-letter code plus Show QR. Friend scans the code to open this same game and join.",
            note,
            max_h=72 * mm,
        )
    )

    # 5 P2P - THE BIG SECTION
    story.append(PageBreak())
    story.append(Paragraph("5. Making P2P feel smooth", h1))
    story.append(
        Paragraph(
            "This is the expensive part of the project. A 1v1 snowball fight is sparse "
            "(a few dogs, occasional throws) but unforgiving: if a hit lands a beat late, "
            "it feels broken. The host’s machine runs the real simulation. The guest’s machine "
            "predicts, interpolates, and is corrected. There is no GGPO rollback and no "
            "dedicated sim server — on purpose. Below is every technique that is actually in the code.",
            body,
        )
    )

    story.append(Paragraph("5.1 The unfair clock", h2))
    story.append(
        Paragraph(
            "Host-authoritative P2P is uneven by default: the host is 0 ms from the sim, "
            "the guest is one round-trip away. LAN still feels lopsided. "
            "A game server would make <i>both</i> sides guests (fairer, not always faster). "
            "For a friend-code 1v1 we instead delay the host a little and predict on the guest.",
            body,
        )
    )
    story.append(
        pair_shots(
            SHOT["host"],
            "Host: Maltese (white, right). Same room code in the HUD (Maltese).",
            SHOT["guest"],
            "Guest: mirrored. White Maltese now on the left; retrievers on the right. HUD says Retriever.",
            note,
        )
    )

    delay_tbl = [
        [Paragraph("Seat", head), Paragraph("Without help", head), Paragraph("With current netcode", head)],
        [
            Paragraph("Host (Maltese)", cellb),
            Paragraph("Instant move, instant throw, instant hit.", cell),
            Paragraph("Move still instant. Throw shows a ghost ball at once; real collision waits clamp(RTT/2, 30–80 ms).", cell),
        ],
        [
            Paragraph("Guest (retriever)", cellb),
            Paragraph("Waits a full snapshot (~70–220 ms) to see anything.", cell),
            Paragraph("Own move/throw are local. Opponent pose is interpolated 55–70 ms. Hits flash locally, then confirm.", cell),
        ],
    ]
    story.append(contrast_table(delay_tbl, [32 * mm, 69 * mm, 69 * mm]))

    story.append(Paragraph("5.2 What actually goes over the wire", h2))
    story.append(
        Paragraph(
            "Early builds sent the whole yard 10–14 times a second (every kid, every ball, forts, phase). "
            "That is simple and laggy. The current split:",
            body,
        )
    )
    wire = [
        [Paragraph("Message", head), Paragraph("Channel", head), Paragraph("Rate / when", head), Paragraph("Payload", head)],
        [
            Paragraph("pose", cellb),
            Paragraph("Unreliable (may drop)", cell),
            Paragraph("~14–20 Hz", cell),
            Paragraph("id, x, y, vx, vy, facing, state, hp", cell),
        ],
        [
            Paragraph("throw", cellb),
            Paragraph("Reliable + HTTP copy", cell),
            Paragraph("On release", cell),
            Paragraph("id, origin, velocity, team, t0", cell),
        ],
        [
            Paragraph("hit", cellb),
            Paragraph("Reliable + HTTP copy", cell),
            Paragraph("On damage", cell),
            Paragraph("id, hp, heavy (bury)", cell),
        ],
        [
            Paragraph("snap", cellb),
            Paragraph("Unreliable keyframe", cell),
            Paragraph("Every 1.2 s + start", cell),
            Paragraph("Full field for recovery only", cell),
        ],
        [
            Paragraph("over / start / rematch / packed / bye", cellb),
            Paragraph("Reliable + unreliable + HTTP; no seq-drop", cell),
            Paragraph("Events; over repeats 0.35 s", cell),
            Paragraph("Winner (tiny over has no snapshot)", cell),
        ],
        [
            Paragraph("input", cellb),
            Paragraph("Move = pose; down/up = reliable", cell),
            Paragraph("Guest stick + throw", cell),
            Paragraph("x, y, hold, vx, vy, at (timestamp)", cell),
        ],
        [
            Paragraph("ping / pong", cellb),
            Paragraph("Unreliable", cell),
            Paragraph("2 s", cell),
            Paragraph("t0, t1 → RTT + clock offset", cell),
        ],
    ]
    story.append(contrast_table(wire, [38 * mm, 42 * mm, 42 * mm, 48 * mm]))

    story.append(Paragraph("5.3 Catalogue of smoothness work", h2))
    story.append(
        Paragraph(
            "Numbered as built, not as a wish list. This is the section that answers "
            "“what did you do so PvP does not feel like a slideshow”.",
            note,
        )
    )

    items = [
        (
            "1. Host input delay",
            "Host throws are queued by clamp(RTT/2, 30–80) ms before they enter the authoritative sim. "
            "Guest input already paid the network RTT, so both throws land in a similar window. "
            "Movement stays immediate so the dog still follows the finger.",
        ),
        (
            "2. Host ghost ball (local prediction)",
            "On release the host spawns a ghost snowball: it flies and paints, but does not collide. "
            "When the delay elapses the ghost is killed and a real ball is committed + broadcast. "
            "The host sees an instant throw; fairness stays in the delayed hit test.",
        ),
        (
            "3. Guest local move & throw",
            "Guest dogs follow the pointer with no round-trip. Guest throws spawn local balls immediately "
            "and also send input.at to the host. Pose packets do not overwrite the grabbed dog.",
        ),
        (
            "4. Guest predicted hits",
            "If a local ball overlaps an enemy, the guest flashes hurt + SFX at once, without changing HP. "
            "A matching hit packet confirms (HP/bury). If nothing arrives in ~140 ms, the flash is rolled back. "
            "Juice is instant; score is still host-declared.",
        ),
        (
            "5. Remote interpolation (not dead reckoning)",
            "Opponent dogs are painted 55–70 ms in the past, lerped between two pose samples. "
            "The grabbed local dog is not interpolated. This replaced vx·lead extrapolation, which "
            "fought with lag compensation. Balls still fly in present time; kids on screen lag a beat "
            "so motion is smooth instead of snapping at 14 Hz.",
        ),
        (
            "6. Clock offset",
            "Ping carries t0; pong echoes t0 and t1. Each side estimates peerTime − localTime, smoothed. "
            "Guest uses hostNow ≈ now + offset when applying poses. "
            "Guest inputs carry at; the host maps them into its delay buffer instead of applying wall-clock-now.",
        ),
        (
            "7. Keyframes do not clobber balls",
            "The 1.2 s snapshot repairs kids and HP. Local and ghost balls are kept unless a host ball "
            "from the same thrower is already nearby. Predicted throws no longer pop out of existence.",
        ),
        (
            "8. Two data channels + HTTP belt",
            "Unreliable channel: poses, pings (drop stale). Ordered reliable: throws, hits, over. "
            "over / start / rematch / packed / bye also copy onto the unreliable channel and HTTP/SSE, "
            "and they ignore the sequence filter so a late snapshot cannot eat the winner.",
        ),
        (
            "9. Outcome is not a snapshot",
            "A fat WireState over packet was easy to drop. Now a tiny { winner } is sent as well, "
            "resent every 0.35 s, and poses keep advertising phase won/lost after the heat. "
            "Guest can infer the result three ways. Rematch start is recovered from a fight pose "
            "if both players already voted yes.",
        ),
        (
            "10. Packed handshake",
            "The match does not start until both browsers have the pose sprites. "
            "Prevents one side fighting blobs while the other has dogs, which felt like desync.",
        ),
        (
            "11. ICE / TURN / relay HUD",
            "STUN first; ExpressTURN from server env (never committed). ICE restart if stuck; "
            "fall back to SSE poll. HUD shows direct vs relay, RTT, fps so we can tell lag from art.",
        ),
        (
            "12. Guest-local presentation",
            "Idle fidget, walk cycle, aim line, particles, SFX, and 3-2-1 ticks run locally. "
            "They are not networked. Traffic stays tiny; the yard still looks alive.",
        ),
        (
            "13. Ally bots on the guest",
            "Defend / Attack for unselected Maltese (or retrievers on guest) step locally; "
            "poses and throws are sent up. The guest does not wait for the host to wiggle idle dogs.",
        ),
        (
            "14. What we did not do",
            "No GGPO rollback (sim is not deterministic: Math.random, wall clocks). "
            "No dedicated game server (1v1 friend rooms; signaling is enough). "
            "No binary protobuf yet — JSON poses are already small. "
            "Those remain valid later if this becomes ranked matchmaking.",
        ),
        (
            "15. Throw timestamps (t0) on both seats",
            "Host, guest, and ally throws carry t0 (plus guest input.at). "
            "The host maps peer time through clockOffset and either queues a future throw "
            "or catch-up-simulates a late one. Charge seconds are ignored in Versus.",
        ),
        (
            "16. Host catch-up (projectile, not hitscan rewind)",
            "If a guest throw arrives up to ~200 ms late, the host looks up the thrower in pose history, "
            "spawns the ball there, and steps that one ball forward against historical kid positions. "
            "This is not CS lag compensation (no rewind of the whole yard for a hitscan). "
            "Snowballs fly; we only fix when they were born.",
        ),
        (
            "17. Versus throw profile",
            "PvP: auto-aim nearest foe; fixed range 520 and speed 440; tap and hold fly the same. "
            "Pack remains 0.92 s. Vs AI keeps tap-near / hold-far and Hard’s 2× ball speed. "
            "Guest replicas of opponent balls use the same 520 range (not 2400).",
        ),
    ]
    for title, text in items:
        story.append(Paragraph(title, h2))
        story.append(Paragraph(text, body))

    story.append(Paragraph("5.4 Throw path (sequence)", h2))
    story.append(
        Paragraph(
            "Host runs the real collision. Guest only paints: local ball, predicted flash, interpolated dogs. "
            "HP changes on <font face='Courier'>hit</font>; the heat ends on <font face='Courier'>over</font>. "
            "A wrong prediction rolls back the flash, not the whole field.",
            body,
        )
    )
    story.append(Paragraph("Guest throw (how it feels vs how it scores)", h2))
    story.append(
        SeqDiag(
            ["Guest 畫面", "Host sim"],
            [
                ("self", 0, "本地波 + 預測閃"),
                ("msg", 0, 1, "throw / input.at"),
                ("self", 1, "權威碰撞（可 catch-up）"),
                ("msg", 1, 0, "hit 或 timeout 撤回", True),
            ],
            caption="Guest 出手：畫面即時，HP 等 host。",
        )
    )
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("Host throw (ghost, then delayed real ball)", h2))
    story.append(
        SeqDiag(
            ["Host 畫面", "Host sim"],
            [
                ("self", 0, "ghost 波（唔碰撞）"),
                ("msg", 0, 1, "delay clamp(RTT/2, 30–80ms)"),
                ("self", 1, "真波 + 碰撞"),
                ("msg", 1, 0, "廣播 throw / hit 去 guest", True),
            ],
            caption="Host 出手：即時畫面，命中刻意遲半程 RTT。",
        )
    )
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("Clock + interpolation", h2))
    story.append(
        SeqDiag(
            ["Guest 畫面", "Host sim"],
            [
                ("msg", 1, 0, "pose @ 14–20 Hz（t0, x, y, vx）"),
                ("self", 0, "lerp 55–70ms 前嘅兩幀"),
                ("msg", 0, 1, "ping t0  /  pong t0,t1", True),
                ("self", 1, "clockOffset、RTT HUD"),
            ],
            caption="對手狗插值；自己拖住嗰隻跟手指，唔入過去。",
        )
    )
    story.append(Spacer(1, 3 * mm))
    story.append(
        HFlow(
            [
                "Finger up",
                "Local / ghost",
                "input + t0",
                "Host delay / catch-up",
                "Real collide",
                "hit / over",
            ]
        )
    )
    story.append(Spacer(1, 2 * mm))
    story.append(
        captioned(
            SHOT["throw"],
            "Throw strip: local art first, host collision later. Versus always this range.",
            note,
            max_h=34 * mm,
        )
    )

    story.append(Paragraph("5.5 Why not a sim server", h2))
    story.append(
        Paragraph(
            "A server would equalize latency (both sides ~RTT to Tokyo/Singapore) and help anti-cheat. "
            "It would not make LAN faster, and it would add 24/7 ops. "
            "For a 6-dog yard, pose+event+prediction is the right cost curve. "
            "Revisit a server if we add public matchmaking or need to stop a host from lying about HP.",
            body,
        )
    )

    story.append(Paragraph("5.6 Versus combat recipe", h2))
    story.append(
        Paragraph(
            "Versus is not the same sport as Vs AI. Charge was a local timer and did not cost RTT, "
            "but it split tap-near / hold-far and made guest/host hold seconds a possible disagreement. "
            "PvP now: auto-aim the nearest enemy for <b>direction only</b>; <b>range 520</b> and "
            "<b>speed 440</b> every shot; pack still 0.92 s. A tap and a long hold fly the same. "
            "Hard’s 2× ball speed is not used in Versus — it would make delay a large fraction of flight time.",
            body,
        )
    )
    pvp_tbl = [
        [Paragraph("Knob", head), Paragraph("Vs AI", head), Paragraph("Versus", head)],
        [
            Paragraph("Aim", cellb),
            Paragraph("Nearest (optional scatter on Hard)", cell),
            Paragraph("Nearest foe, both seats", cell),
        ],
        [
            Paragraph("Charge", cellb),
            Paragraph("Tap near, 1.2 s hold = full field", cell),
            Paragraph("None — tap = hold", cell),
        ],
        [
            Paragraph("Range / speed", cellb),
            Paragraph("58–820 px / 360–500 (Hard ×2)", cell),
            Paragraph("520 / 440, both seats + replicas", cell),
        ],
        [
            Paragraph("Pack", cellb),
            Paragraph("0.92 s", cell),
            Paragraph("0.92 s (reload is the cadence)", cell),
        ],
    ]
    story.append(contrast_table(pvp_tbl, [32 * mm, 69 * mm, 69 * mm]))

    story.append(Paragraph("5.7 How this sits vs GGPO, RTS, CS", h2))
    story.append(
        Paragraph(
            "We borrowed CS’s idea (predict yourself, authority elsewhere) and RTS’s idea "
            "(don’t snapshot the whole army). We did not take fighting-game rollback or RTS lockstep.",
            body,
        )
    )
    cmp_tbl = [
        [Paragraph("Family", head), Paragraph("Sends", head), Paragraph("Authority", head), Paragraph("We took", head)],
        [
            Paragraph("RTS lockstep (AoE, SC)", cellb),
            Paragraph("Commands only", cell),
            Paragraph("Everyone’s same sim", cell),
            Paragraph("Tiny events, not 2000-unit snapshots. Not lockstep — we need instant drag.", cell),
        ],
        [
            Paragraph("CS / Source FPS", cellb),
            Paragraph("Input + server snapshots", cell),
            Paragraph("Dedicated server; rewind hitscan", cell),
            Paragraph("Local move, interp remotes. Snowballs are projectiles: catch-up spawn, not hitscan rewind.", cell),
        ],
        [
            Paragraph("GGPO / rollback", cellb),
            Paragraph("Per-frame input", cell),
            Paragraph("Both sims, rewind on mismatch", cell),
            Paragraph("Not used. Sim has Math.random and wall clocks. Flash rollback only.", cell),
        ],
        [
            Paragraph("This game", cellb),
            Paragraph("Pose 14–20 Hz + throw/hit/over", cell),
            Paragraph("Host browser", cell),
            Paragraph("Listen-server CS + RTS-sized payloads + host delay to fake fairness.", cell),
        ],
    ]
    story.append(contrast_table(cmp_tbl, [36 * mm, 38 * mm, 42 * mm, 54 * mm]))
    story.append(Spacer(1, 3 * mm))
    story.append(
        SeqDiag(
            ["你 (GGPO)", "對手 sim"],
            [
                ("self", 0, "當對手 idle，即刻模擬"),
                ("msg", 1, 0, "遲 4 幀：真實 input", True),
                ("self", 0, "rollback 4 幀再 simulate"),
                ("msg", 0, 1, "checksum（一致先繼續）"),
            ],
            caption="對照：GGPO 兩邊都係真 sim，錯就倒帶成場。雪仗唔做呢步。",
        )
    )
    story.append(Spacer(1, 4 * mm))

    # 6
    story.append(Paragraph("6. Vs AI (for contrast)", h1))
    story.append(
        Paragraph(
            "Easy: original pacing, nearest-target bots, forts are cover only, Maltese revive next heat. "
            "Hard: bot move ×3, smarter dodge, forts have 10 HP, no Maltese revive, "
            "Maltese move ×2 and both teams’ snowballs ×2. "
            "Same sim as PvP; no net. Difficulty is chosen on a gate after Play vs AI, "
            "which is also when sprites load (progress bar).",
            body,
        )
    )

    # 7
    story.append(Paragraph("7. Loading strategy", h1))
    story.append(
        Paragraph(
            "SSR paints a Loading spinner until React hydrates, then the title card. "
            "Play vs AI / Friend are real buttons only after hydrate. "
            "hydrateCore (idle dogs + fort) and hydrateRest (throw/hurt/walk/…) run after a mode is chosen. "
            "Unused placeholder characters were removed so the landing wait is not packing dead art.",
            body,
        )
    )

    # 8
    story.append(Paragraph("8. Trust and secrets", h1))
    story.append(
        Paragraph(
            "TURN username/credential live in server env / local .env, never in git. "
            "The public repo only has empty TURN_USERNAME / TURN_CREDENTIAL in .env.example. "
            "P2P gameplay is host-honest: a cheating host can still lie. Fine for friends; not for ranked.",
            body,
        )
    )

    # 9
    story.append(Paragraph("9. Credits (short)", h1))
    story.append(
        Paragraph(
            "Game: Nicholson NY, SnowCraft, 1998. Characters: moonlab / Line Puppy (fan illustration). "
            "Fight feel referenced jeffreywilbur/snowcraftjs. "
            "Libraries (MIT / Apache-2.0 / ISC / OFL) are listed in-app at /credits.",
            body,
        )
    )

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.4, color=LINE))
    story.append(
        Paragraph(
            "End of briefing. Source of truth is the beta branch of the GitHub repo; "
            "this PDF describes the P2P pose/prediction stack as of August 2026.",
            note,
        )
    )

    doc = SimpleDocTemplate(
        OUT,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=16 * mm,
        title="Maltese Snow War — Architecture briefing",
        author="Grok Build",
        subject="Code structure and P2P smoothness",
    )
    doc.build(story, onFirstPage=cover_page, onLaterPages=header_footer)
    print(OUT)


if __name__ == "__main__":
    build()
