# Gera os ícones PNG do app (sem dependências).
import zlib, struct, math, sys

def png(path, size):
    bg = (5, 8, 7); lime = (198, 244, 50); white = (244, 247, 242)
    rows = []
    s = size
    r_wheel = s * 0.17; th = max(2, s * 0.045)
    c1 = (s * 0.29, s * 0.62); c2 = (s * 0.71, s * 0.62)
    def seg(px, py, ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    frame = [(c1, (s*0.45, s*0.40)), ((s*0.45, s*0.40), (s*0.66, s*0.40)), ((s*0.66, s*0.40), c2),
             ((s*0.45, s*0.40), (s*0.52, s*0.62)), ((s*0.52, s*0.62), c1), ((s*0.52, s*0.62), (s*0.66, s*0.40)),
             ((s*0.66, s*0.40), (s*0.63, s*0.30)), ((s*0.42, s*0.33), (s*0.50, s*0.33))]
    for y in range(s):
        row = bytearray([0])
        for x in range(s):
            px, py = x + 0.5, y + 0.5
            # cantos arredondados
            rr = s * 0.22
            cx = min(max(px, rr), s - rr); cy = min(max(py, rr), s - rr)
            if math.hypot(px - cx, py - cy) > rr:
                row += bytes((0, 0, 0, 0)); continue
            col = bg
            for c in (c1, c2):
                if abs(math.hypot(px - c[0], py - c[1]) - r_wheel) < th / 2: col = lime
            for a, b in frame:
                if seg(px, py, a[0], a[1], b[0], b[1]) < th / 2: col = white
            row += bytes(col + (255,))
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', s, s, 8, 6, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b''))

png(sys.argv[1] + '/icon.png', 80)
png(sys.argv[1] + '/largeIcon.png', 130)
