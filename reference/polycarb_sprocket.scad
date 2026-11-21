// ============================================================
//  Pin sprocket that drives a perforated polycarbonate sheet,
//  bolted to a 32 mm goBILDA / ServoCity 25T spline servo hub.
//  (OpenSCAD 2021.01 or newer)
//
//  Turning the sprocket rotation_deg moves the sheet travel
//  (default 360 degrees -> 6 in). Travel per full turn =
//  teeth x hole spacing, so the hole spacing in the sheet is what
//  sets the travel. The sprocket diameter is derived from it so
//  the pins line up.
//
//  The companion "Sprocket and sheet planner" page has a
//  "Copy OpenSCAD settings" button: paste its lines over the
//  matching lines below.
//
//  The sheet slides flat past the sprocket (like a rack and
//  pinion), held by a track so its underside sits
//  "axis to sheet underside" mm from the servo shaft (see console).
//
//  part = "sprocket"    : the sprocket
//  part = "drill_guide" : strip for drilling the sheet holes at the
//                         exact spacing. Butt the fence against the
//                         sheet edge, clamp, drill through every hole.
//
//  Modelled in print orientation, no supports needed.
//  Everything is in the Customizer (Window > Customizer).
// ============================================================

/* [What to make] */
part = "sprocket";            // [sprocket, drill_guide]

/* [Motion] */
rotation_deg = 360;           // how far the sprocket turns
travel       = 152.4;         // how far the sheet moves in that turn (mm), 6 in = 152.4

/* [Sheet] */
hole_d         = 4.5;         // holes in the sheet
sheet_t        = 1.5;         // sheet thickness
teeth          = 16;          // hole spacing = travel per full turn / teeth

/* [Pins] */
pin_d        = 4.0;           // pin width at the drum (0.25 mm clearance each side in a 4.5 hole)
pin_straight = 0;             // pin stays full width this far above the drum before tapering
pin_tip_d    = 2.0;           // rounded tip, helps the pin find the hole
pin_h        = 2.6;           // pin height above the drum
sheet_gap    = 0.4;           // gap between the drum and the underside of the sheet
pin_flat   = 0.7;             // pins are trimmed top and bottom to this fraction of pin_d so they print without supports

/* [Body] */
drum_w = 5;                   // sprocket thickness

/* [Hub mounting] */
bolt_square  = 16;            // M4 tapped holes on the hub, square pattern (mm)
bolt_hole_d  = 4.5;           // M4 clearance hole
bolt_head_d  = 7.5;           // M4 socket head plus a little room
counterbore  = 0;             // sink the screw heads this deep (0 = heads sit on the face)
center_d     = 8;             // centre hole, big enough to pass the servo screw head
pilot        = true;          // ring that drops into the hub's 14 mm recess
pilot_d      = 13.7;          // recess is 14 mm
pilot_h      = 1.2;           // short so it clears the servo screw head

/* [Drill guide] */
guide_holes   = 0;            // 0 = enough holes for the full travel
edge_offset   = 8;            // sheet edge to the centreline of the holes
guide_t       = 4;            // guide thickness
guide_hole_d  = 4.7;          // printed holes shrink a little; 4.7 suits a 4.5 mm bit

/* [Hidden] */
$fn  = 64;
eps  = 0.01;
N        = teeth;
travel_per_rev = travel * 360 / rotation_deg;
P        = travel_per_rev / N;            // hole spacing in the sheet
Rp       = travel_per_rev / (2 * PI);     // pitch radius = sheet mid-plane
yb       = Rp - sheet_t / 2;              // axis to sheet underside
r0       = yb - sheet_gap;                // drum radius
tip_r    = r0 + pin_h;
slab_h   = pin_flat * pin_d;              // pin height across the sprocket (Z)
pin_z    = slab_h / 2;                    // pin centreline above the bed face
bolt_r   = bolt_square / sqrt(2);

// how much of the sheet is in contact at once, and holes needed for the travel
phi_in       = acos(min(1, yb / tip_r));
window       = 2 * tip_r * sin(phi_in);
holes_needed = ceil(travel / P - 1e-9) + ceil(window / P - 1e-9) + 1;
n_guide      = guide_holes > 0 ? guide_holes : holes_needed;

// pin width at height u above the drum: the hull of the base cylinder and the tip ball.
// The base itself sits below the sheet; what matters for fit is the width at u = sheet_gap.
function pin_w_at(u) =
    let(a = pin_d / 2, b = pin_tip_d / 2, s = pin_straight, c = pin_h - b,
        dd = sqrt(a * a + (c - s) * (c - s)),
        ang = dd > b ? atan2(s - c, a) + acos(b / dd) : 90,
        tx = b * cos(ang), ty = c + b * sin(ang))
    u <= s ? pin_d
  : (dd > b && u <= ty) ? 2 * (a + (tx - a) * (u - s) / (ty - s))
  : u <= c + b ? 2 * sqrt(max(0, b * b - (u - c) * (u - c)))
  : 0;

grip     = drum_w - counterbore;
screw_l  = [for (l = [6, 8, 10, 12, 14, 16, 20, 25]) if (l >= grip + 4) l][0];

// ---------- sanity checks ----------
assert(part == "sprocket" || part == "drill_guide", "part must be sprocket or drill_guide");
assert(rotation_deg > 0 && travel > 0, "rotation_deg and travel must be above 0");
assert(pin_straight >= 0 && pin_straight < pin_h, "pin_straight must be between 0 and pin_h");
assert(pin_w_at(sheet_gap) < hole_d,
       str("pin is ", pin_w_at(sheet_gap), " mm wide where it enters the sheet: it must be narrower than hole_d"));
assert(P - hole_d >= 1.5, str("holes would be only ", P - hole_d, " mm apart: use fewer teeth"));
assert(pin_h > sheet_gap + sheet_t, "pins are too short to reach through the sheet");
assert(2 * PI * r0 / N > pin_d + 1, "too many teeth: pins would merge on the drum");
assert(r0 > bolt_r + bolt_head_d / 2 + 0.5, "drum too small for the hub screws");
assert(slab_h < drum_w, "pins are thicker than the drum");
assert(counterbore < drum_w - 1, "counterbore leaves less than 1 mm under the screw heads");

echo(str("SHEET DRIVE  ", rotation_deg, " deg of turn moves the sheet ", travel, " mm (", travel / 25.4, " in)"));
echo(str("  teeth=", N, "  travel per full turn=", travel_per_rev, " mm"));
echo(str("  hole spacing in the sheet = ", P, " mm (", P / 25.4, " in), web between holes = ", P - hole_d, " mm"));
echo(str("  pin is ", pin_w_at(sheet_gap), " mm wide where it enters the sheet, play +/-", (hole_d - pin_w_at(sheet_gap)) / 2, " mm"));
echo(str("  axis to sheet underside = ", yb, " mm   drum dia = ", 2 * r0, "   over pins = ", 2 * tip_r));
echo(str("  pin centreline is ", drum_w - pin_z, " mm from the hub face (", pin_z, " mm from the outer face)"));
echo(str("  sheet needs at least ", holes_needed, " holes for the full travel"));
echo(str("  hub screws: 4 x M4 x ", screw_l, " mm socket head"));

// ---------- sprocket ----------
module pin() {
    // tapered pin with a ball tip pointing along +X, trimmed flat top and bottom
    intersection() {
        hull() {
            translate([-1, 0, 0]) rotate([0, 90, 0]) cylinder(d = pin_d, h = 1 + pin_straight + eps);
            translate([pin_h - pin_tip_d / 2, 0, 0]) sphere(d = pin_tip_d, $fn = 32);
        }
        translate([-2, -pin_d, -slab_h / 2]) cube([pin_h + 4, 2 * pin_d, slab_h]);
    }
}

module sprocket() {
    difference() {
        union() {
            cylinder(r = r0, h = drum_w, $fn = 180);
            for (i = [0 : N - 1])
                rotate(i * 360 / N) translate([r0, 0, pin_z]) pin();
            if (pilot)
                translate([0, 0, drum_w - eps]) cylinder(d = pilot_d, h = pilot_h + eps);
        }
        // centre hole: reach / pass the servo screw
        translate([0, 0, -1]) cylinder(d = center_d, h = drum_w + pilot_h + 2);
        // M4 holes on the hub's 16 mm square (corners at 45 degrees)
        for (a = [45 : 90 : 315])
            rotate(a) translate([bolt_r, 0, 0]) {
                translate([0, 0, -1]) cylinder(d = bolt_hole_d, h = drum_w + 2, $fn = 32);
                if (counterbore > 0)
                    translate([0, 0, -1]) cylinder(d = bolt_head_d, h = counterbore + 1, $fn = 32);
            }
    }
}

// ---------- drill guide ----------
// Plate lies on the sheet; the fence catches the sheet edge.
// Printed fence-up: the face the fence sticks out of goes on the sheet.
module drill_guide() {
    margin  = 6;
    len     = (n_guide - 1) * P + 2 * margin;
    width   = edge_offset + hole_d / 2 + margin;
    fence_w = 4;
    fence_h = sheet_t * 0.8;               // a bit shy of the sheet so the guide sits flat
    difference() {
        union() {
            cube([len, width, guide_t]);
            translate([0, -fence_w, 0]) cube([len, fence_w, guide_t + fence_h]);
        }
        for (k = [0 : n_guide - 1])
            translate([margin + k * P, edge_offset, -1])
                cylinder(d = guide_hole_d, h = guide_t + 2, $fn = 48);
    }
    echo(str("  drill guide: ", n_guide, " holes, ", len, " mm long"));
}

if (part == "sprocket") sprocket();
else drill_guide();
