/* ============================================================
   job.js — the PolyPotion compute-job contract (Phase-1 seed)
   ------------------------------------------------------------
   One shared shape for every long-running operation: progress you can
   watch and a cancel that actually stops the work. Before this, each
   tool improvised — Bake Maps had a `_cancel` flag, Director had
   `cancelRecord`, the service worker had its own AbortController, and
   the flagship (the HQ rig bind, which runs in a Worker) had NO cancel
   at all. JobController unifies them:

     • wraps an AbortController  → `job.signal` for anything fetch-like
     • carries an onProgress fn  → `job.progress(phase, frac)`
     • cooperative checkpoints   → `job.checkpoint()` / `await job.tick()`
       for main-thread loops (throw JobCancelled when cancelled)
     • worker handling           → `job.attachWorker(w)` terminates it on cancel
     • promise guarding          → `job.guard(p)` rejects promptly on cancel
       even if the wrapped body ignores the signal

   Cancellation is signalled by rejecting with a JobCancelled error (or any
   error whose message is 'cancelled'); callers test with JobController.isCancel(err)
   and treat it as a clean user action, not a failure.

   Dependency-free classic script. Loads before the engine/app modules and
   exposes `window.JobController` + `window.JobCancelled`.
   ============================================================ */
(function (root) {
  'use strict';

  class JobCancelled extends Error {
    constructor(label) {
      super('cancelled');
      this.name = 'JobCancelled';
      this.cancelled = true;      // duck-typed flag other code can read
      this.job = label || null;
    }
  }

  class JobController {
    constructor(opts) {
      opts = opts || {};
      this.label = opts.label || 'job';
      this.onProgress = opts.onProgress || null;   // (phase, frac) => void
      this.onCancel = opts.onCancel || null;       // () => void, fired once
      this._ac = new AbortController();
      this._workers = new Set();
      this._settled = false;
      this._phase = '';
      this._frac = 0;
    }

    /** AbortSignal — hand to fetch(), or listen for 'abort'. */
    get signal() { return this._ac.signal; }
    /** True once cancel() has fired. */
    get cancelled() { return this._ac.signal.aborted; }
    /** True once the job has finished successfully (settle()). */
    get settled() { return this._settled; }
    /** Last reported phase/fraction, for late UI attach. */
    get phase() { return this._phase; }
    get frac() { return this._frac; }

    /** Report progress. Ignored after cancel so a late worker tick can't
        repaint a bar the user already dismissed. */
    progress(phase, frac) {
      if (this.cancelled) return;
      if (phase != null) this._phase = phase;
      if (frac != null) this._frac = frac;
      if (this.onProgress) this.onProgress(this._phase, this._frac);
    }

    /** Cooperative cancel point for synchronous main-thread loops.
        Call periodically; throws JobCancelled if the user cancelled. */
    checkpoint() {
      if (this.cancelled) throw new JobCancelled(this.label);
    }

    /** checkpoint + yield a macrotask so the cancel click can be processed
        and the UI can paint. Call inside long chunked loops:
          for (…) { if ((i & 1023) === 0) await job.tick(); } */
    async tick() {
      this.checkpoint();
      await new Promise(r => setTimeout(r, 0));
      this.checkpoint();
    }

    /** Register a Worker so cancel() terminates it. Returns the worker. */
    attachWorker(w) {
      this._workers.add(w);
      if (this.cancelled) { try { w.terminate(); } catch (_) {} return w; }
      this.signal.addEventListener('abort', () => {
        try { w.terminate(); } catch (_) {}
      }, { once: true });
      return w;
    }

    /** Wrap a promise so cancel() rejects it promptly with JobCancelled,
        even when the underlying work can't observe the signal itself
        (the work keeps running but its result is abandoned). */
    guard(promise) {
      return new Promise((resolve, reject) => {
        if (this.cancelled) { reject(new JobCancelled(this.label)); return; }
        const onAbort = () => reject(new JobCancelled(this.label));
        this.signal.addEventListener('abort', onAbort, { once: true });
        Promise.resolve(promise).then(
          v => { this.signal.removeEventListener('abort', onAbort); resolve(v); },
          e => { this.signal.removeEventListener('abort', onAbort); reject(e); }
        );
      });
    }

    /** Cancel the job: abort the signal, terminate attached workers, fire
        onCancel once. No-op if already cancelled or settled. */
    cancel(reason) {
      if (this._ac.signal.aborted || this._settled) return;
      try { this._ac.abort(reason || 'cancelled'); } catch (_) {}
      this._workers.forEach(w => { try { w.terminate(); } catch (_) {} });
      this._workers.clear();
      if (this.onCancel) { try { this.onCancel(); } catch (_) {} }
    }

    /** Mark finished so a trailing cancel() becomes a no-op. */
    settle() { this._settled = true; this._workers.clear(); }
  }

  /** True for a JobCancelled or any error that means "the user cancelled". */
  JobController.isCancel = function (e) {
    return !!(e && (e.cancelled === true || e.name === 'JobCancelled' ||
      String(e && e.message) === 'cancelled'));
  };

  root.JobController = JobController;
  root.JobCancelled = JobCancelled;
})(typeof window !== 'undefined' ? window : self);
