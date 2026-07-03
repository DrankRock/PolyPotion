// ============================================================
// AUTORIG — HUMANOID JOINT TEMPLATE
// A normalized skeleton definition. Positions are in a unit space:
//   feet at y=0, top of head ~ y=1.0, x = right(+)/left(-), z = front(+)/back(-)
// The app scales/positions this to fit the loaded mesh's bounding box,
// then the user nudges each joint into the mesh across the ortho views.
//
// Joints are grouped so whole groups (hands, fingers, feet, face) can be
// toggled off before rigging. Every joint has a parent (by id) which defines
// the bone hierarchy that the skeleton builder will assemble.
// ============================================================
window.RigTemplate = (function () {

  // Base (right side / center). Left side is mirrored automatically across X.
  // pos = [x, y, z] in normalized unit-height space.
  // side: 'C' center, 'R' right (mirrored to 'L'). 'R' joints get an L twin.
  const DEF = [
    // ---- core spine ----
    { id: 'Hips',      label: 'Hips (root)',      group: 'core',  side: 'C', parent: null,    pos: [0, 0.500, 0.00] },
    { id: 'Spine',     label: 'Spine',            group: 'core',  side: 'C', parent: 'Hips',   pos: [0, 0.580, 0.00] },
    { id: 'Chest',     label: 'Chest',            group: 'core',  side: 'C', parent: 'Spine',  pos: [0, 0.680, 0.00] },
    { id: 'Neck',      label: 'Neck (base)',      group: 'core',  side: 'C', parent: 'Chest',  pos: [0, 0.790, 0.01] },
    { id: 'Head',      label: 'Head',             group: 'head',  side: 'C', parent: 'Neck',   pos: [0, 0.875, 0.02] },
    { id: 'HeadTop',   label: 'Head top',         group: 'head',  side: 'C', parent: 'Head',   pos: [0, 0.980, 0.02] },

    // ---- face (eyes / jaw) — parented to Head ----
    { id: 'Eye',       label: 'Eye',              group: 'face',  side: 'R', parent: 'Head',   pos: [0.035, 0.905, 0.075] },
    { id: 'Jaw',       label: 'Jaw',              group: 'face',  side: 'C', parent: 'Head',   pos: [0.000, 0.852, 0.055] },
    { id: 'JawTip',    label: 'Jaw tip (chin)',   group: 'face',  side: 'C', parent: 'Jaw',    pos: [0.000, 0.835, 0.080] },

    // ---- arms (right; mirrored to left) ----
    { id: 'Shoulder',  label: 'Shoulder',         group: 'arms',  side: 'R', parent: 'Chest',     pos: [0.170, 0.795, 0.00] },
    { id: 'Elbow',     label: 'Elbow',            group: 'arms',  side: 'R', parent: 'Shoulder',  pos: [0.330, 0.795, 0.00] },
    { id: 'Wrist',     label: 'Hand base (wrist)',group: 'arms',  side: 'R', parent: 'Elbow',     pos: [0.480, 0.795, 0.00] },

    // ---- fingers (right hand; mirrored). 3 phalanges per finger, chained. ----
    { id: 'Thumb1',  label: 'Thumb · base',   group: 'fingers', side: 'R', parent: 'Wrist',  pos: [0.500, 0.782, 0.034] },
    { id: 'Thumb2',  label: 'Thumb · mid',    group: 'fingers', side: 'R', parent: 'Thumb1', pos: [0.524, 0.772, 0.050] },
    { id: 'Thumb3',  label: 'Thumb · tip',    group: 'fingers', side: 'R', parent: 'Thumb2', pos: [0.544, 0.763, 0.062] },

    { id: 'Index1',  label: 'Index · base',   group: 'fingers', side: 'R', parent: 'Wrist',  pos: [0.535, 0.793, 0.018] },
    { id: 'Index2',  label: 'Index · mid',    group: 'fingers', side: 'R', parent: 'Index1', pos: [0.575, 0.793, 0.018] },
    { id: 'Index3',  label: 'Index · tip',    group: 'fingers', side: 'R', parent: 'Index2', pos: [0.606, 0.793, 0.018] },

    { id: 'Middle1', label: 'Middle · base',  group: 'fingers', side: 'R', parent: 'Wrist',  pos: [0.538, 0.794, 0.000] },
    { id: 'Middle2', label: 'Middle · mid',   group: 'fingers', side: 'R', parent: 'Middle1',pos: [0.581, 0.794, 0.000] },
    { id: 'Middle3', label: 'Middle · tip',   group: 'fingers', side: 'R', parent: 'Middle2',pos: [0.614, 0.794, 0.000] },

    { id: 'Ring1',   label: 'Ring · base',    group: 'fingers', side: 'R', parent: 'Wrist',  pos: [0.535, 0.793, -0.018] },
    { id: 'Ring2',   label: 'Ring · mid',     group: 'fingers', side: 'R', parent: 'Ring1',  pos: [0.574, 0.793, -0.018] },
    { id: 'Ring3',   label: 'Ring · tip',     group: 'fingers', side: 'R', parent: 'Ring2',  pos: [0.603, 0.793, -0.018] },

    { id: 'Pinky1',  label: 'Pinky · base',   group: 'fingers', side: 'R', parent: 'Wrist',  pos: [0.528, 0.791, -0.034] },
    { id: 'Pinky2',  label: 'Pinky · mid',    group: 'fingers', side: 'R', parent: 'Pinky1', pos: [0.561, 0.791, -0.034] },
    { id: 'Pinky3',  label: 'Pinky · tip',    group: 'fingers', side: 'R', parent: 'Pinky2', pos: [0.585, 0.791, -0.034] },

    // ---- legs (right; mirrored) ----
    { id: 'UpperLeg',  label: 'Upper leg (groin)',group: 'legs',  side: 'R', parent: 'Hips',     pos: [0.090, 0.495, 0.00] },
    { id: 'Knee',      label: 'Knee',             group: 'legs',  side: 'R', parent: 'UpperLeg', pos: [0.095, 0.260, 0.01] },
    { id: 'Ankle',     label: 'Ankle',            group: 'legs',  side: 'R', parent: 'Knee',     pos: [0.095, 0.045, -0.01] },
    { id: 'Toe',       label: 'Toe',              group: 'feet',  side: 'R', parent: 'Ankle',    pos: [0.095, 0.010, 0.090] },
  ];

  const GROUPS = [
    { id: 'core',    label: 'Spine & hips',  removable: false },
    { id: 'arms',    label: 'Arms',          removable: true  },
    { id: 'legs',    label: 'Legs',          removable: false },
    { id: 'head',    label: 'Head & neck',   removable: true  },
    { id: 'feet',    label: 'Feet / toes',   removable: true  },
    { id: 'fingers', label: 'Fingers',       removable: true, defaultOff: true },
    { id: 'face',    label: 'Face (eyes/jaw)', removable: true, defaultOff: true },
  ];

  // Build the flat joint list (expanding R → R+L), with unique ids + parent links.
  function build() {
    const joints = [];
    const idFor = (base, side) => side === 'C' ? base : `${base}_${side}`;

    DEF.forEach(d => {
      const sides = d.side === 'C' ? ['C'] : ['R', 'L'];
      sides.forEach(side => {
        const sign = side === 'L' ? -1 : 1;
        // parent: a center parent stays center; a sided parent matches this side
        let parentId = null;
        if (d.parent) {
          const pdef = DEF.find(x => x.id === d.parent);
          parentId = pdef && pdef.side === 'C' ? pdef.id : idFor(d.parent, side);
        }
        joints.push({
          id: idFor(d.id, side),
          base: d.id,
          label: side === 'C' ? d.label : `${d.label} ${side}`,
          shortSide: side,
          group: d.group,
          parent: parentId,
          // mirror X for the left side
          home: [d.pos[0] * sign, d.pos[1], d.pos[2]],
          pos: [d.pos[0] * sign, d.pos[1], d.pos[2]],
        });
      });
    });
    return joints;
  }

  return { build, GROUPS, DEF };
})();
