// designer-wallcut.js — Wall cutout system.
//
// When an object that has a void (door frame, window frame, archway, etc.)
// is placed against or near a wall, the wall geometry is modified to have
// an opening matching the object's bounding box or declared cutout region.
//
// How it works:
//   1. Objects can declare `wallCut: { width, height, sill }` in their meta
//      params. If not declared, the system uses the object's bounding box.
//   2. On every shell rebuild, placed objects are scanned. If an object's
//      position is within `threshold` of a wall segment, a virtual opening
//      is injected into that wall segment's data before mesh generation.
//   3. The openings are temporary — they exist only during the rebuild and
//      don't modify the plan data. Moving the object moves the cutout.
//
// This hooks into both the plan-based wall system (rebuildAllFloors in
// designer-sims.js) and the simple shell walls (rebuildShell in designer.html).

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;
    const $ = _D.$;

    const WALL_PROXIMITY = 0.35; // max distance from wall center to trigger cutout

    // ── Detect which objects should cut walls ──────────
    function getWallCutObjects() {
      const cutters = [];
      _D.items.forEach((entry) => {
        if (!entry.obj3d.visible) return;
        const cut = getWallCutInfo(entry);
        if (!cut) return;
        cutters.push({
          entry,
          pos: entry.obj3d.position.clone(),
          rotY: entry.obj3d.rotation.y,
          width: cut.width,
          height: cut.height,
          sill: cut.sill || 0,
        });
      });
      return cutters;
    }

    // Get wall-cut info from an object. Sources (in priority order):
    //   1. Explicit wallCut in opts: { wallCut: true, cutWidth, cutHeight, cutSill }
    //   2. Meta params with wallCut declared
    //   3. Object type name contains "door" or "window" or "arch" → use bbox
    function getWallCutInfo(entry) {
      // Check opts for explicit wallCut
      if (entry.opts && entry.opts.wallCut === true) {
        return {
          width: entry.opts.cutWidth || entry.opts.width || 1,
          height: entry.opts.cutHeight || entry.opts.height || 2.1,
          sill: entry.opts.cutSill || 0,
        };
      }

      // Check meta for wallCut declaration
      if (_D.OBJ) {
        const meta = _D.OBJ.list().find((o) => o.name === entry.type);
        if (meta && meta.wallCut) {
          const opts = entry.opts || {};
          return {
            width: opts[meta.wallCut.widthKey || "width"] || meta.wallCut.width || 1,
            height: opts[meta.wallCut.heightKey || "height"] || meta.wallCut.height || 2.1,
            sill: opts[meta.wallCut.sillKey || "sill"] || meta.wallCut.sill || 0,
          };
        }
      }

      // Auto-detect by type name
      const name = (entry.type || entry.name || "").toLowerCase();
      if (name.includes("door") || name.includes("gate") || name.includes("arch") || name.includes("portal")) {
        const opts = entry.opts || {};
        return {
          width: opts.width || getBBoxWidth(entry) || 1,
          height: opts.height || getBBoxHeight(entry) || 2.1,
          sill: 0,
        };
      }
      if (name.includes("window")) {
        const opts = entry.opts || {};
        return {
          width: opts.width || getBBoxWidth(entry) || 0.9,
          height: opts.height || 1.2,
          sill: opts.sill || 1.0,
        };
      }

      return null; // not a wall-cutting object
    }

    function getBBoxWidth(entry) {
      const box = new THREE.Box3().setFromObject(entry.obj3d);
      const size = new THREE.Vector3();
      box.getSize(size);
      // Width is the larger of X and Z (the object might be rotated)
      return Math.max(size.x, size.z);
    }
    function getBBoxHeight(entry) {
      const box = new THREE.Box3().setFromObject(entry.obj3d);
      const size = new THREE.Vector3();
      box.getSize(size);
      return size.y;
    }

    // ── Match cutters to wall segments ────────────────
    // For a given plan (vertices + segments) at a given yBase,
    // return a map: segmentIndex → array of virtual openings to add
    function matchCuttersToSegments(planData, yBase, floorHeight, cutters) {
      const result = new Map(); // segIdx → [{t, width, height, sill, type}]

      if (!planData || !planData.vertices || !planData.segments) return result;

      planData.segments.forEach((seg, segIdx) => {
        const vA = planData.vertices[seg.a];
        const vB = planData.vertices[seg.b];
        if (!vA || !vB) return;

        const segLen = Math.hypot(vB.x - vA.x, vB.y - vA.y);
        if (segLen < 0.1) return;

        // Wall direction unit vector
        const ux = (vB.x - vA.x) / segLen;
        const uy = (vB.y - vA.y) / segLen;
        // Wall normal (perpendicular)
        const nx = -uy;
        const ny = ux;

        cutters.forEach((c) => {
          // Check Y range — object must be on this floor
          if (c.pos.y < yBase - 0.1 || c.pos.y > yBase + floorHeight + 0.1) return;

          // Project object position onto wall line
          // Wall goes from vA to vB in plan coords (X, Z in world → x, y in plan)
          const objPlanX = c.pos.x;
          const objPlanY = c.pos.z; // world Z = plan Y

          // Vector from vA to object
          const dx = objPlanX - vA.x;
          const dy = objPlanY - vA.y;

          // Parameter t along segment (0 = at vA, 1 = at vB)
          const t = (dx * ux + dy * uy) / segLen;
          if (t < -0.05 || t > 1.05) return; // outside segment

          // Distance from wall line (perpendicular)
          const dist = Math.abs(dx * nx + dy * ny);
          if (dist > WALL_PROXIMITY) return; // too far from wall

          // This cutter is near this wall segment — add a virtual opening
          const clampedT = Math.max(0.01, Math.min(0.99, t));
          if (!result.has(segIdx)) result.set(segIdx, []);

          // Determine if it's a door or window type based on sill
          const type = c.sill > 0.1 ? "window" : "door";

          result.get(segIdx).push({
            t: clampedT,
            width: c.width,
            height: c.height,
            sill: c.sill,
            type: type,
            _fromObject: c.entry.name, // for debugging
          });
        });
      });

      return result;
    }

    // ── Merge virtual openings with plan openings ─────
    // Returns a new segments array with virtual openings added
    function mergeOpenings(planData, virtualOpenings) {
      if (!virtualOpenings.size) return planData.segments;
      return planData.segments.map((seg, idx) => {
        if (!virtualOpenings.has(idx)) return seg;
        const extra = virtualOpenings.get(idx);
        // Clone segment and merge openings
        const merged = {
          a: seg.a,
          b: seg.b,
          openings: [...(seg.openings || []), ...extra],
        };
        // Sort by t to maintain order
        merged.openings.sort((a, b) => a.t - b.t);
        return merged;
      });
    }

    // ── Public API ────────────────────────────────────
    // This is called by the shell builders before generating wall meshes.
    // It returns augmented plan data with virtual openings from placed objects.
    window._wallCut = {
      getAugmentedPlan: function (planData, yBase, floorHeight) {
        const cutters = getWallCutObjects();
        if (!cutters.length) return planData;
        const virtualOpenings = matchCuttersToSegments(planData, yBase, floorHeight, cutters);
        if (!virtualOpenings.size) return planData;
        const augmented = {
          vertices: planData.vertices,
          segments: mergeOpenings(planData, virtualOpenings),
          arcs: planData.arcs,
        };
        return augmented;
      },
      // Also handle simple shell walls (the PlaneGeometry walls from rebuildShell)
      getSimpleWallCuts: function (wallDef, items) {
        // wallDef: { face: "back"|"front"|"left"|"right", W, D, H, hW, hD }
        // Returns array of {x, y, width, height} cuts in wall-local coords
        const cuts = [];
        const cutters = getWallCutObjects();
        cutters.forEach((c) => {
          const pos = c.pos;
          let wallDist, wallT, wallLen;
          const wd = wallDef;

          if (wd.face === "back") {
            wallDist = Math.abs(pos.z - (-wd.hD));
            wallT = (pos.x + wd.hW) / wd.W;
            wallLen = wd.W;
          } else if (wd.face === "front") {
            wallDist = Math.abs(pos.z - wd.hD);
            wallT = (pos.x + wd.hW) / wd.W;
            wallLen = wd.W;
          } else if (wd.face === "left") {
            wallDist = Math.abs(pos.x - (-wd.hW));
            wallT = (pos.z + wd.hD) / wd.D;
            wallLen = wd.D;
          } else if (wd.face === "right") {
            wallDist = Math.abs(pos.x - wd.hW);
            wallT = (pos.z + wd.hD) / wd.D;
            wallLen = wd.D;
          }

          if (wallDist > WALL_PROXIMITY) return;
          if (wallT < -0.05 || wallT > 1.05) return;

          cuts.push({
            t: Math.max(0.01, Math.min(0.99, wallT)),
            width: c.width,
            height: c.height,
            sill: c.sill,
            type: c.sill > 0.1 ? "window" : "door",
          });
        });
        return cuts;
      },
    };

    // ── Hook into rebuild cycles ──────────────────────
    // Patch the sims rebuildAllFloors if it exists
    function hookSims() {
      if (!window._sims || !window._sims.rebuildAllFloors) {
        setTimeout(hookSims, 200);
        return;
      }
      // The sims module already uses buildSegmentMeshes which handles
      // openings in segments. We need to intercept and augment the plan
      // data before it builds meshes.
      //
      // We do this by patching the plan data that rebuildAllFloors reads.
      // The cleanest hook: override plan._autoBuild to augment before build.
      //
      // Actually, the simplest approach: hook into rebuildAllFloors by
      // making the augmented plan available. The sims module iterates
      // f.plan.segments — we want it to iterate augmented segments.
      //
      // Best approach: rebuildAllFloors calls buildSegmentMeshes for each
      // segment. We'll make it use augmented plan data.

      // Store reference to original
      const origRebuild = window._sims.rebuildAllFloors;

      // We can't easily patch the inner loop. Instead, temporarily
      // modify the plan data, rebuild, then restore.
      window._sims.rebuildAllFloors = function () {
        // Augment each floor's plan before rebuild
        const floors = window._sims.floors;
        const saved = new Map();
        floors.forEach((f) => {
          if (!f.plan || !f.plan.segments.length) return;
          saved.set(f.id, f.plan.segments);
          const augmented = window._wallCut.getAugmentedPlan(f.plan, f.yBase, f.height);
          f.plan.segments = augmented.segments;
        });
        // Run original rebuild
        origRebuild();
        // Restore original segments (so plan editor doesn't see virtual openings)
        saved.forEach((segs, fid) => {
          const f = floors.find((x) => x.id === fid);
          if (f && f.plan) f.plan.segments = segs;
        });
      };
    }
    hookSims();

    // Also patch the simple shell rebuild for non-plan walls
    // This is trickier since the simple walls are PlaneGeometry.
    // For simple walls, we'll replace them with multi-piece geometry
    // (like the plan wall builder does with openings).
    const origRebuildShell = window.D && window.D.rebuildShell;
    if (origRebuildShell) {
      // We need to add cuts after the shell is built. Instead of
      // replacing PlaneGeometry walls with complex geometry (which
      // would be fragile), we'll hook into the post-rebuild and
      // replace wall meshes that have cuts nearby.
      //
      // For the plan-based walls this is already handled above.
      // For simple "4 walls" / "3 walls" mode, we'll rebuild
      // affected walls with openings.

      const patchSimpleWalls = () => {
        const wallsMode = $("rWalls").value;
        if (wallsMode === "plan" || wallsMode === "0") return;

        const W = parseFloat($("rW").value) || 6;
        const D = parseFloat($("rD").value) || 5;
        const H = parseFloat($("rH").value) || 2.8;
        const hW = W / 2, hD = D / 2;
        const wc = parseInt($("rWallCol").value.slice(1), 16);

        const faces = [];
        if (wallsMode === "4" || wallsMode === "3" || wallsMode === "back")
          faces.push({ face: "back", W, D, H, hW, hD });
        if (wallsMode === "4" || wallsMode === "3") {
          faces.push({ face: "left", W, D, H, hW, hD });
          faces.push({ face: "right", W, D, H, hW, hD });
        }
        if (wallsMode === "4")
          faces.push({ face: "front", W, D, H, hW, hD });

        faces.forEach((wd) => {
          const cuts = window._wallCut.getSimpleWallCuts(wd, _D.items);
          if (!cuts.length) return;

          // Find and remove the original wall plane for this face
          const shell = _D.shell;
          let wallLen, wallMesh = null;
          if (wd.face === "back") wallLen = W;
          else if (wd.face === "front") wallLen = W;
          else wallLen = D;

          // Find the wall mesh by position
          shell.children.forEach((c) => {
            if (!c.isMesh) return;
            if (c.geometry.type !== "PlaneGeometry") return;
            if (wd.face === "back" && Math.abs(c.position.z - (-hD)) < 0.01) wallMesh = c;
            else if (wd.face === "front" && Math.abs(c.position.z - hD) < 0.01) wallMesh = c;
            else if (wd.face === "left" && Math.abs(c.position.x - (-hW)) < 0.01) wallMesh = c;
            else if (wd.face === "right" && Math.abs(c.position.x - hW) < 0.01) wallMesh = c;
          });

          if (!wallMesh) return;

          // Remove original wall
          shell.remove(wallMesh);
          wallMesh.geometry.dispose();

          // Build replacement with openings (like the plan wall builder)
          const wallMat = new THREE.MeshStandardMaterial({
            color: wc, roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
          });
          const thick = 0.08; // thin wall

          // Sort cuts by t
          const sorted = cuts.slice().sort((a, b) => a.t - b.t);
          const pieces = [];
          let cursor = 0;

          sorted.forEach((cut) => {
            const halfTW = (cut.width / wallLen) / 2;
            const opStart = Math.max(0, cut.t - halfTW);
            const opEnd = Math.min(1, cut.t + halfTW);

            if (opStart > cursor + 0.001)
              pieces.push({ t0: cursor, t1: opStart, y0: 0, y1: H });

            if (cut.type === "door") {
              if (cut.height < H)
                pieces.push({ t0: opStart, t1: opEnd, y0: cut.height, y1: H });
            } else {
              if (cut.sill > 0)
                pieces.push({ t0: opStart, t1: opEnd, y0: 0, y1: cut.sill });
              if (cut.sill + cut.height < H)
                pieces.push({ t0: opStart, t1: opEnd, y0: cut.sill + cut.height, y1: H });
            }
            cursor = opEnd;
          });

          if (cursor < 1 - 0.001)
            pieces.push({ t0: cursor, t1: 1, y0: 0, y1: H });

          pieces.forEach((p) => {
            const pieceLen = (p.t1 - p.t0) * wallLen;
            const pieceH = p.y1 - p.y0;
            if (pieceLen < 0.001 || pieceH < 0.001) return;

            const tMid = (p.t0 + p.t1) / 2;
            const box = new THREE.Mesh(new THREE.BoxGeometry(pieceLen, pieceH, thick), wallMat);

            if (wd.face === "back") {
              box.position.set(-hW + tMid * wallLen, p.y0 + pieceH / 2, -hD);
            } else if (wd.face === "front") {
              box.position.set(-hW + tMid * wallLen, p.y0 + pieceH / 2, hD);
            } else if (wd.face === "left") {
              box.position.set(-hW, p.y0 + pieceH / 2, -hD + tMid * wallLen);
            } else if (wd.face === "right") {
              box.position.set(hW, p.y0 + pieceH / 2, -hD + tMid * wallLen);
            }

            shell.add(box);
          });
        });
      };

      // Hook: run after every rebuildShell
      const origRSInner = _D.rebuildShell;
      _D.rebuildShell = function () {
        origRSInner();
        try { patchSimpleWalls(); } catch (e) { console.warn("wallcut patch:", e); }
      };
      // Also patch window.D version
      if (window.D.rebuildShell) {
        const origDRS = window.D.rebuildShell;
        window.D.rebuildShell = function () {
          origDRS.apply(this, arguments);
          try { patchSimpleWalls(); } catch (e) { console.warn("wallcut patch:", e); }
        };
      }
    }

    // Re-run wall cuts whenever an object moves (gizmo drag end)
    _D.gizmo.addEventListener("dragging-changed", (e) => {
      if (!e.value) {
        // Drag ended — check if the moved object is a cutter
        if (_D.sel) {
          const cut = getWallCutInfo(_D.sel);
          if (cut) {
            // Rebuild shell to update wall cuts
            setTimeout(() => window.D.rebuildShell(), 50);
          }
        }
      }
    });

    // Also re-run on object add/delete
    const origAddObj = window.D.addObject;
    if (origAddObj) {
      window.D.addObject = function () {
        const r = origAddObj.apply(this, arguments);
        const last = _D.items[_D.items.length - 1];
        if (last) {
          const cut = getWallCutInfo(last);
          if (cut) setTimeout(() => window.D.rebuildShell(), 100);
        }
        return r;
      };
    }
    const origDeleteSel = window.D.deleteSel;
    if (origDeleteSel) {
      window.D.deleteSel = function () {
        const wasCutter = _D.sel ? !!getWallCutInfo(_D.sel) : false;
        const r = origDeleteSel.apply(this, arguments);
        if (wasCutter) setTimeout(() => window.D.rebuildShell(), 50);
        return r;
      };
    }
  }
})();
