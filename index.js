window.NorthSkyOS = {
  track(event, data) {
    fetch("https://your-api.com/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        data,
        session: localStorage.getItem("ns_session_id"),
        user: localStorage.getItem("ns_user_id"),
        score: localStorage.getItem("ns_score"),
        url: location.href
      })
    });
  },

  route(score) {
    if (score >= 15) {
      window.location.href = "https://goldylox752.github.io/RoofFlow-AI/";
    }
  }
};



(function () {

  /* ===============================
     INIT GUARD (PREVENT DOUBLE LOAD)
  =============================== */

  if (window.NorthSkyOS) return;

  /* ===============================
     CONFIG
  =============================== */

  const CONFIG = {
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    scoreKey: "ns_score",
    source: "skymaster_x1",
    crmEndpoint: null,
    hotThreshold: 15
  };

  /* ===============================
     IDENTITY (GLOBAL ACROSS ALL SITES)
  =============================== */

  const uuid = () => crypto.randomUUID();

  const getOrCreate = (key) => {
    let value = localStorage.getItem(key);
    if (!value) {
      value = uuid();
      localStorage.setItem(key, value);
    }
    return value;
  };

  const session = getOrCreate(CONFIG.sessionKey);
  const user = getOrCreate(CONFIG.userKey);

  /* ===============================
     SCORE ENGINE (STABLE + SIMPLE)
  =============================== */

  const SCORE = {
    page_view: 1,
    click: 3,
    funnel_click: 8,
    stripe_click: 15
  };

  function getScore() {
    return Number(localStorage.getItem(CONFIG.scoreKey) || 0);
  }

  function setScore(v) {
    localStorage.setItem(CONFIG.scoreKey, String(v));
  }

  function addScore(event) {
    const next = getScore() + (SCORE[event] || 0);
    setScore(next);
    return next;
  }

  function getStage(score) {
    if (score >= CONFIG.hotThreshold) return "HOT";
    if (score >= 6) return "WARM";
    return "COLD";
  }

  /* ===============================
     CRM SYNC (OPTIONAL)
  =============================== */

  function send(event, data) {

    const payload = {
      event,
      data,

      user_id: user,
      session_id: session,

      score: getScore(),
      stage: getStage(getScore()),

      source: CONFIG.source,
      url: location.href,
      time: new Date().toISOString()
    };

    console.log("[NS DRONE]", payload);

    if (CONFIG.crmEndpoint) {
      fetch(CONFIG.crmEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }
  }

  /* ===============================
     TRACK CORE FUNCTION
  =============================== */

  function track(event, data = {}) {

    const score = addScore(event);

    const payload = {
      event,
      data,

      user_id: user,
      session_id: session,

      score,
      stage: getStage(score),

      url: location.href
    };

    console.log("[TRACK]", payload);

    send(event, data);

    if (score >= CONFIG.hotThreshold) {
      send("hot_lead", { score });
    }
  }

  /* ===============================
     FUNNEL NAVIGATION
  =============================== */

  function go(url, label = "funnel") {
    track("funnel_click", { url, label });
    window.open(url, "_blank");
  }

  /* ===============================
     AUTO TRACKING
  =============================== */

  function init() {

    track("page_view");

    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, button");
      if (!el) return;

      track("click", {
        text: el.innerText?.trim() || null,
        href: el.href || null
      });
    });

    window.addEventListener("beforeunload", () => {
      send("time_on_page", {
        seconds: Math.round(performance.now() / 1000)
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  /* ===============================
     GLOBAL EXPORT (CONNECTS ALL SITES)
  =============================== */

  window.NorthSkyOS = {
    track,
    go,
    session: () => session,
    user: () => user,
    score: getScore,
    stage: () => getStage(getScore())
  };

})();