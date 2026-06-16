# ============================================================================
# Ricci Flow on Surfaces of Revolution
# ============================================================================
#
# Simulates 2D Ricci flow on a surface of revolution and exports Asawa-style
# wireframe OBJ curves at each timestep. The surface metric
# ds^2 = h(rho)*drho^2 + m(rho)*dtheta^2
# evolves under the flow dg/dt = -2*R*g, where R is the scalar curvature.
#
# ---------------------------------------------------------------------------
# Ruth Asawa-style wireframe exports
# ---------------------------------------------------------------------------
#
# One function generates interlocking looped wireframes inspired by
# Ruth Asawa's crocheted wire sculptures. It produces OBJ polyline
# curves (use Rhino's Pipe command for wire thickness).  They share the
# same structure — two families of sinusoidal wires (horizontal latitude
# loops + vertical meridian curves) with alternating normal offsets for
# over/under depth.
#
#   export_arclength_asawa_obj()
#       Equal arc-length spacing along the embedded meridian curve
#       (x(rho), y(rho)).  Gives visually uniform ring-to-ring distance
#       when viewed from the side — the spacing you would get wrapping
#       physical wire around the form at regular intervals.
#
# Supports n_shells >= 2 for Asawa's signature nested concentric
# layers (each shell 15% smaller).
# ---------------------------------------------------------------------------

import numpy as np
import os
from scipy.ndimage import gaussian_filter1d

# Constants
N = 801 # Resolution
c3, c5 = 0.0, 0.0 # Shape parameters for initial metric
n_fft = 50 # Number of Fourier terms for filtering
do_deriv_adj = True # Flag for derivative adjustment at poles
tm = 0.0 # Time tracker
still_ok = True # Flag to track numerical stability

# Arrays for metric components and coordinates
h = np.ones(N) # g_{11} = h(ρ), initially constant
m = np.zeros(N) # g_{22} = m(ρ)
sm = np.zeros(N) # Square root for m, i.e., √m(ρ)
x = np.zeros(N) # x(ρ) for generating curve
y = np.zeros(N) # y(ρ) = √m(ρ)
oh = np.zeros(N) # Old h for undo
om = np.zeros(N) # Old m
osm = np.zeros(N) # Old sm
nh = np.zeros(N) # New h for update
nm = np.zeros(N) # New m
tmp = np.zeros(N) # Temporary array for filtering
sh = np.zeros(N) # √h for parameterization

metric = 0

# Arrays for parametrization
para_i = np.zeros(16)
para_l = np.zeros(16)
para_i0 = np.zeros(16)
para_l0 = np.zeros(16)

def resolution():
    return N

def coord_x():
    return x

def coord_y():
    return y

def init(): # Initialize metric components h and m
    global h, m, sm, para_i, para_l
    for i in range(N):
        rho = ((i - 1.0) * np.pi) / (N - 3.0)
        h[i] = 1.0
        v = (np.sin(rho) + c5 * np.sin(5.0 * rho) + c3 * np.sin(3.0 * rho)) /  (1.0 + 3.0 * c3 + 5.0 * c5)
        if 20 < i < N - 21 and abs(v) < 0.05: # Handles numerical stability near poles and negative values
            m[i] = -1.0
        elif v < 0.0:
            m[i] = -1.0
        else:
            m[i] = v ** 2
    m[1] = m[N - 2] = 0.0 # Poles condition
    m[0] = m[2]
    m[N - 1] = m[N - 3]

    sm = np.sqrt(np.maximum(m, 0.0))

    for i in range(16):
        para_i[i] = (i * N + N / 2) / 16
        para_l[i] = -1.0

def reset_shape(cc3, cc5): # Reset shape with new c3, c5 parameters and compute x, y
    global c3, c5
    oc3, oc5 = c3, c5
    c3, c5 = cc3, cc5
    init()
    ret = make_xy()
    if not ret:
        c3, c5 = oc3, oc5
        init()
        make_xy()
    return ret

def filter(): # Apply Fourier-based filtering to h and sm to reduce numerical instability
    global h, tm, sm, m, still_ok
    tmp = np.zeros(N)
    av = 0.0
    for k in range(0, n_fft, 2):
        ftt = 0.5 * (h[1] * np.cos(k * ((1 - 1.0) * np.pi) / (N - 3.0)) + h[(N - 1) // 2] * np.cos(k * (((N - 1) // 2 - 1.0) * np.pi) / (N - 3.0)))
        c = np.cos(k * ((2 - 1.0) * np.pi) / (N - 3.0))
        s = np.sin(k * ((2 - 1.0) * np.pi) / (N - 3.0))
        dc = np.cos(k * (1.0 * np.pi) / (N - 3.0))
        ds = np.sin(k * (1.0 * np.pi) / (N - 3.0))
        for i in range(2, (N - 1) // 2):
            ftt += h[i] * c
            tc = dc * c - ds * s
            s = ds * c + dc * s
            c = tc
        if k == 0:
            ftt /= 0.5 * (N - 3.0)
        else:
            ftt *= 4.0 / (N - 3.0)
        av += np.abs(ftt * k)
        if k > n_fft // 2:
            if ftt * k / av / h[1] > 0.1 and k > n_fft - 20 and tm > 0.001:
                still_ok = False
            ftt *= 1.0 - np.sqrt((k - n_fft / 2) / (0.5 * n_fft + 0.1))
            if ftt > 0.001:
                ftt *= 0.1
            if ftt > 0.01:
                ftt *= 0.1
        for i in range((N - 1) // 2 + 1):
            tmp[i] += ftt * np.cos(k * ((i - 1.0) * np.pi) / (N - 3.0))
        for i in range((N + 1) // 2, N):
            tmp[i] = tmp[N - 1 - i]
    h = np.where(tmp > 1e-6, tmp, 1e-6)

    deriv = 0.0
    tmp = np.zeros(N)
    for k in range(1, n_fft, 2):
        ftt = 0.5 * (sm[1] * np.sin(k * ((1 - 1.0) * np.pi) / (N - 3.0)) + sm[(N - 1) // 2] * np.sin(
            k * (((N - 1) // 2 - 1.0) * np.pi) / (N - 3.0)))
        c = np.cos(k * ((2 - 1.0) * np.pi) / (N - 3.0))
        s = np.sin(k * ((2 - 1.0) * np.pi) / (N - 3.0))
        dc = np.cos(k * (1.0 * np.pi) / (N - 3.0))
        ds = np.sin(k * (1.0 * np.pi) / (N - 3.0))
        for i in range(2, (N - 1) // 2):
            ftt += sm[i] * s
            tc = dc * c - ds * s
            s = ds * c + dc * s
            c = tc
        ftt *= 4.0 / (N - 3.0)
        if k > n_fft // 2:
            ftt *= 1.0 - (k - n_fft / 2) / (0.5 * n_fft + 0.1)
            if ftt > 0.001:
                ftt *= 0.1
            if ftt > 0.01:
                ftt *= 0.1
        deriv += ftt * k
        for i in range((N - 1) // 2 + 1):
            tmp[i] += ftt * np.sin(k * ((i - 1.0) * np.pi) / (N - 3.0))
        for i in range((N + 1) // 2, N):
            tmp[i] = tmp[N - 1 - i]

    ftt = np.sqrt(h[1]) / deriv if do_deriv_adj and deriv !=0 else 1.0
    for i in range(1, (N - 1) // 2 + 1):
        sm[i] = np.abs(tmp[i]) * (ftt + i * (i / 500.0) / n_fft) / (1.0 + i * (i / 500.0) / n_fft)
        m[i] = sm[i] ** 2
    sm[0] = sm[2]
    m[0] = m[2]
    for i in range((N + 1) // 2, N):
        sm[i] = sm[N - 1 - i]
        m[i] = m[N - 1 - i]

def undo_step(): # Revert to previous state
    global h, m , sm
    h = oh.copy()
    m = om.copy()
    sm = osm.copy()

def step(dt): # Advance Ricci flow by time step dt using finite differences
    global h, m, sm, oh, om, osm, nh, nm
    oh = h.copy()
    om = m.copy()
    osm = sm.copy()
    l = (N - 3.0) / np.pi

    for n in range(1):
        for k in range(4):
            for j in range(1): # Poles
                ddh = (h[2] - 2.0 * h[1] + h[0]) * l ** 2
                dm_m = (2.0 * m[3] - 8.0 * m[2]) * l ** 2 / (2.0 * m[2]) if m[2] > 1e-10 else 0.0
                nh[1] = h[1] - 2.0 * dt * (ddh / (2.0 * h[1]) - 0.25 * dm_m) if h[1] > 1e-10 else h[1]
                nm[1] = 0.0

                ddh = (h[N - 1] - 2.0 * h[N - 2] + h[N - 3]) * l ** 2
                dm_m = (2.0 * m[N - 4] - 8.0 * m[N - 3]) * l ** 2 / (2.0 * m[N - 3]) if m[N - 3] > 1e-10 else 0.0
                nh[N - 2] = h[N - 2] - 2.0 * dt * (ddh / (2.0 * h[N - 2]) - 0.25 * dm_m) if h[N - 2] > 1e-10 else h[N - 2]
                nm[N - 2] = 0.0

                for i in range(2, N - 2): # Interior points
                    if i < 2 or i > N - 3:
                        continue
                    if i == 2 or i == N - 3:
                        dh = (h[i + 1] - h[i - 1]) * l * 0.5
                        dm = (m[i + 1] - m[i - 1]) * l * 0.5
                        dsm = (sm[i + 1] - 2.0 * sm[i] + sm[i - 1]) * l ** 2
                    else:
                        dh1 = (h[i + 1] - h[i - 1]) * l * 0.5 - (h[i + 2] - 2.0 * h[i + 1] + 2.0 * h[i - 1] - h[i - 2]) * l * 0.5 / 6.0
                        dh2 = (h[i + 2] - h[i - 2]) * l * 0.25 - (h[i + 2] - 2.0 * h[i + 1] + 2.0 * h[i - 1] - h[i - 2]) * l * 0.5 / 6.0
                        dh3 = (h[i + 1] - h[i - 1]) * l * 0.5
                        dh4 = (h[i + 2] - h[i - 2]) * l * 0.25
                        dh = min([dh1, dh2, dh3, dh4], key=abs)
                        dm1 = (m[i + 1] - m[i - 1]) * l * 0.5 - (m[i + 2] - 2.0 * m[i + 1] + 2.0 * m[i - 1] - m[i - 2]) * l * 0.5 / 6.0
                        dm2 = (m[i + 2] - m[i - 2]) * l * 0.25 - (m[i + 2] - 2.0 * m[i + 1] + 2.0 * m[i - 1] - m[i - 2]) * l * 0.5 / 6.0
                        dm3 = (m[i + 1] - m[i - 1]) * l * 0.5
                        dm4 = (m[i + 2] - m[i - 2]) * l * 0.25
                        dm = min([dm1, dm2, dm3, dm4], key=abs)
                        dsm1 = (sm[i + 1] - 2.0 * sm[i] + sm[i - 1]) * l ** 2 - (sm[i - 2] - 4.0 * sm[i - 1] + 6.0 * sm[i] - 4.0 * sm[i + 1] + sm[i + 2]) * l ** 2 / 8.0
                        dsm2 = (sm[i + 2] - 2.0 * sm[i] + sm[i - 2]) * l ** 2 * 0.25 - (sm[i - 2] - 4.0 * sm[i - 1] + 6.0 * sm[i] - 4.0 * sm[i + 1] + sm[i + 2]) * l ** 2 / 8.0
                        dsm3 = (sm[i + 1] - 2.0 * sm[i] + sm[i - 1]) * l ** 2
                        dsm4 = (sm[i + 2] - 2.0 * sm[i] + sm[i - 2]) * l ** 2 * 0.25
                        dsm = min([dsm1, dsm2, dsm3, dsm4], key=abs)

                    dm_m = dm / m[i] if m[i] > 1e-10 else 0.0
                    hder = (-dsm / sm[i] + 0.25 * dm_m * dh / h[i]) if sm[i] > 1e-10  and h[i] > 1e-10 else 0.0

                    nh[i] = h[i] - 2.0 * dt * hder
                    nm[i] = max(0.0, m[i] - 2.0 * dt * hder * m[i] / h[i]) if h[i] > 1e-10 else m[i]

                nh[0] = nh[2]
                nm[0] = nm[2]
                nh[N - 1] = nh[N - 3]
                nm[N - 1] = nm[N - 3]

                h[1:N - 1] = nh[1:N - 1]
                m[1:N - 1] = nm[1:N - 1]

                m[0] = m[2]
                h[0] = h[2]
                m[N - 1] = m[N - 3]
                h[N - 1] = h[N - 3]

                sm = np.sqrt(np.maximum(m, 0.0))
            filter()
        rescale()


# noinspection PyTypeChecker
def make_xy(): # Compute generating curve x(ρ), y(ρ)
    global x, y, still_ok
    l = (N - 3.0) / np.pi

    x[1] = 0.0
    y[1] = 0.0

    if np.any(np.isnan(m)) or np.any(np.isnan(h)) or np.any(np.isnan(sm)):
        return False

    for i in range(2, N - 1):
        if m[i] < -0.1:
            return False
        y[i] = 0.0 if m[i] < 0.0 else sm[i]

        dm = (sm[i] - sm[i - 1]) * l
        hh = h[i - 1]
        dx1 = np.sqrt(max(hh - dm ** 2, 0.0)) / l

        dm = (sm[i] - sm[i - 1]) * l
        hh = 0.5 * (h[i - 1] + h[i])
        dx2 = np.sqrt(max(hh - dm ** 2, 0.0)) / l

        dm = (sm[i + 1] - sm[i - 1]) * l * 0.5
        hh = h[i]
        dx3 = np.sqrt(max(hh - dm ** 2, 0.0)) / l

        if dx1 == 0.0 and dx2 == 0.0 and dx3 == 0.0:
            return False
        x[i] = x[i - 1] + 0.25 * dx1 + 0.5 * dx2 + 0.25 * dx3

    x[1:N - 2] -= 0.5 * x[N - 2]
    x[N - 2] *= 0.5

    x[0] = x[1]
    y[0] = y[1]
    x[N - 1] = x[N - 2]
    y[N - 1] = y[N - 2]

    return still_ok

def rescale(): # Reparametrize to keep h constant
    global sh, sm, m, h, para_i, para_l, tmp
    for i in range(((N - 1) // 2) + 1):
        sh[i] = np.sqrt(h[i])
    for i in range((N + 1) // 2, N):
        sh[i] = sh[N - 1 - i]

    len_ = 0.5 * (sh[1] + sh[(N - 1) // 2]) + np.sum(sh[2 : (N -1) // 2])
    len_ *= 2.0 * np.pi / (N - 3.0)
    len_ = max(len_, 1e-10) # Prevent zero length

    para_l[:] = -1.0

    l = 0.0
    for i in range(1, N-1):
        a = 0.5 * (sh[i + 1] - sh[i]) * np.pi / (N - 3.0)
        b = sh[i] * np.pi / (N - 3.0)

        for j in range(16):
            if i > para_i[j] - 1 and para_l[j] == -1.0:
                para_l[j] = l + a * (para_i[j] - i) ** 2 + b * (para_i[j] - i)

        l += a + b

    para_i = 1.0 + (N - 3.0) * para_l / len_

    tmp[1] = 0.0
    ii = 2
    l = 0.0
    for i in range(1, N-1):
        a = 0.5 * (sh[i + 1] - sh[i]) * np.pi / (N - 3.0) + 1e-10 # Small offset to avoid zero
        b = sh[i] * np.pi / (N - 3.0)
        while True:
            if ii > N - 3:
                break
            c = l - len_ * (ii - 1.0) / (N - 3.0)
            if abs(2.0 * a * c / (b * b)) < 1e-8:
                s1 = -c / b
            else:
                s1 = (-b + np.sqrt(b * b - 4.0 * a * c)) / (2.0 * a)

            if s1 <= 1.0:
                tmp[ii] = sm[i] + s1 * (sm[i + 1] - sm[i])
                ii += 1
                continue
            elif i == N - 3 and s1 <= 1.00001:
                tmp[ii] = sm[i + 1]
                ii += 1

            l += a + b
            break

    tmp[N - 2] = 0.0
    tmp[0] = tmp[2]
    tmp[N - 1] = tmp[N - 3]

    sm = tmp.copy()
    m = sm ** 2

    h[:] = max((len_ / np.pi) ** 2, 1e-10)

def export_arclength_asawa_obj(filename="ricci_asawa_arclength.obj",
                              n_horiz=16, n_vert=24,
                              n_pts=200, amplitude=0.35,
                              wire_offset=0.01, n_shells=1):
    """Export an Asawa-style wireframe with arc-length-spaced rings.

    Horizontal wires are placed at equal arc-length intervals along the
    embedded meridian curve (x(rho), y(rho)).  This gives visually uniform
    spacing that follows the surface profile naturally — the spacing you
    would get wrapping physical wire around the form at regular intervals.

    Args:
        filename:     Output OBJ path.
        n_horiz:      Horizontal (latitude) wire count.
        n_vert:       Vertical (meridian) wire count.
        n_pts:        Sample points per wire (smoothness).
        amplitude:    Undulation size as a fraction of local wire spacing.
        wire_offset:  Normal-direction offset for over/under depth.
        n_shells:     Concentric shells (>=2 for nested look).
    """
    make_xy()

    # Profile-curve derivatives for surface normals
    dx_dr = np.zeros(N)
    dy_dr = np.zeros(N)
    for i in range(2, N - 2):
        dx_dr[i] = (x[i + 1] - x[i - 1]) * 0.5
        dy_dr[i] = (y[i + 1] - y[i - 1]) * 0.5
    dx_dr[1] = dx_dr[2];  dy_dr[1] = dy_dr[2]
    dx_dr[0] = dx_dr[1];  dy_dr[0] = dy_dr[1]
    dx_dr[N - 2] = dx_dr[N - 3]; dy_dr[N - 2] = dy_dr[N - 3]
    dx_dr[N - 1] = dx_dr[N - 2]; dy_dr[N - 1] = dy_dr[N - 2]

    y_max = float(np.max(y)) + 1e-10
    rho_lo, rho_hi = 1, N - 2

    # ---- Arc-length-based horizontal wire positions ----
    margin = 0.08
    lo = int(rho_lo + (rho_hi - rho_lo) * margin)
    hi = int(rho_hi - (rho_hi - rho_lo) * margin)
    # Cumulative arc length along the embedded profile curve
    ds = np.sqrt(np.diff(x[lo:hi + 1]) ** 2 + np.diff(y[lo:hi + 1]) ** 2)
    cum_arc = np.concatenate(([0.0], np.cumsum(ds)))
    cum_arc /= cum_arc[-1]  # normalise to [0, 1]
    rho_indices = np.arange(lo, hi + 1, dtype=float)
    targets = np.linspace(0.0, 1.0, n_horiz + 2)[1:-1]
    horiz_rho = np.interp(targets, cum_arc, rho_indices)

    def lerp(rho_f):
        rho_f = np.clip(rho_f, rho_lo, rho_hi)
        i0 = min(int(rho_f), rho_hi - 1)
        t = rho_f - i0
        return (x[i0] + t * (x[i0 + 1] - x[i0]),
                max(y[i0] + t * (y[i0 + 1] - y[i0]), 0.0),
                dx_dr[i0] + t * (dx_dr[i0 + 1] - dx_dr[i0]),
                dy_dr[i0] + t * (dy_dr[i0 + 1] - dy_dr[i0]))

    def surface_pt(rho_f, theta, noff):
        xi, yi, dxi, dyi = lerp(rho_f)
        ct, st = np.cos(theta), np.sin(theta)
        px, py, pz = xi, yi * ct, yi * st
        if abs(noff) > 1e-12 and yi > 1e-10:
            nx = yi * dyi
            ny = -dxi * yi * ct
            nz = -dxi * yi * st
            nl = np.sqrt(nx * nx + ny * ny + nz * nz)
            if nl > 1e-10:
                s = noff / nl
                px += s * nx; py += s * ny; pz += s * nz
        return (px, py, pz)

    # Per-wire local amplitude
    amp_theta = amplitude * (2.0 * np.pi / n_vert)
    local_amp = np.zeros(n_horiz)
    for hi_idx in range(n_horiz):
        if n_horiz == 1:
            local_amp[hi_idx] = amplitude * (rho_hi - rho_lo)
        elif hi_idx == 0:
            local_amp[hi_idx] = amplitude * (horiz_rho[1] - horiz_rho[0])
        elif hi_idx == n_horiz - 1:
            local_amp[hi_idx] = amplitude * (horiz_rho[-1] - horiz_rho[-2])
        else:
            local_amp[hi_idx] = amplitude * 0.5 * (horiz_rho[hi_idx + 1] - horiz_rho[hi_idx - 1])

    all_verts = []
    all_lines = []

    for shell in range(n_shells):
        sc = 1.0 - shell * 0.15
        wo = wire_offset * sc

        for hi_idx in range(n_horiz):
            rb = horiz_rho[hi_idx]
            _, yb, _, _ = lerp(rb)
            fade = min(yb / y_max, 1.0)
            a_rho = local_amp[hi_idx]
            pts = []
            for k in range(n_pts):
                th = 2.0 * np.pi * k / n_pts
                ra = rb + a_rho * fade * np.sin(n_vert * th)
                no = wo * np.cos(n_vert * th) * ((-1) ** (hi_idx + shell))
                p = surface_pt(ra, th, no)
                if sc != 1.0:
                    p = (p[0], p[1] * sc, p[2] * sc)
                pts.append(p)
            si = len(all_verts)
            all_verts.extend(pts)
            all_lines.append(list(range(si, si + len(pts))) + [si])

        rho_arr = np.linspace(rho_lo + 1, rho_hi - 1, n_pts)
        rho_norm = (rho_arr - rho_lo) / (rho_hi - rho_lo)
        for vi in range(n_vert):
            tb = 2.0 * np.pi * vi / n_vert
            pts = []
            for k in range(n_pts):
                rho = rho_arr[k]; rn = rho_norm[k]
                _, yh, _, _ = lerp(rho)
                fade = min(yh / y_max, 1.0)
                ta = tb + amp_theta * fade * np.sin(n_horiz * np.pi * rn)
                no = wo * np.cos(n_horiz * np.pi * rn) * ((-1) ** (vi + 1 + shell))
                p = surface_pt(rho, ta, no)
                if sc != 1.0:
                    p = (p[0], p[1] * sc, p[2] * sc)
                pts.append(p)
            si = len(all_verts)
            all_verts.extend(pts)
            all_lines.append(list(range(si, si + len(pts))))

    with open(filename, "w") as f:
        f.write("# Arc-length-spaced Asawa-style wire sculpture\n")
        f.write(f"# {n_horiz} horizontal (arc-length) + {n_vert} vertical"
                f" x {n_shells} shell(s)\n")
        f.write(f"# amplitude={amplitude}, wire_offset={wire_offset}\n")
        f.write(f"# c3={c3:.3f}, c5={c5:.3f}\n\n")
        for v in all_verts:
            f.write(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
        f.write("\n")
        for line in all_lines:
            f.write("l " + " ".join(str(i + 1) for i in line) + "\n")

    nw = (n_horiz + n_vert) * n_shells
    print(f"Arc-length Asawa saved: {filename} "
          f"({len(all_verts)} verts, {nw} wires, {n_shells} shell(s))")


if __name__ == "__main__":
    reset_shape(0.766, -0.091)  # Dumbbell shape
    num_steps = 500
    save_every = 20 # Save every N steps
    dt = 0.0001

    save_indices = range(0, num_steps, save_every)

    for i in range(num_steps):
        step(dt)

        if not make_xy():
            print("Numerical instability detected")
            break

        # Debug plot every 20 steps
        if i in save_indices:
            y_filtered = gaussian_filter1d(y, sigma=0.5)
            y[:] = y_filtered

            os.makedirs("wireframe_files", exist_ok=True)

            export_arclength_asawa_obj(f"wireframe_files/asawa_arclength_{i}.obj",
                                       n_horiz=16, n_vert=24, n_pts=100)
            export_arclength_asawa_obj(f"wireframe_files/asawa_arclength_fine_{i}.obj",
                                       n_horiz=36, n_vert=54, n_pts=300)
