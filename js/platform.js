(function () {
  "use strict";
  const lang = document.documentElement.dataset.lang || "en",
    t = window.TS_COPY[lang] || window.TS_COPY.en,
    main = document.querySelector("main");
  if (!main) return;
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const field = (label, input) => {
    const l = make("label", "", label);
    l.append(input);
    return l;
  };
  const option = (v, label) => {
    const o = make("option", "", label);
    o.value = v;
    return o;
  };
  const button = (text, fn) => {
    const b = make("button", "", text);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };
  function copyControl(getValue) {
    let timer;
    return button(t.copy, async function (e) {
      const b = e.currentTarget;
      clearTimeout(timer);
      try {
        await navigator.clipboard.writeText(getValue());
        b.textContent = t.copied;
      } catch {
        b.textContent = t.copyError;
      }
      timer = setTimeout(() => (b.textContent = t.copy), 2200);
    });
  }
  // A compact contents index keeps all original article sections accessible.
  const heads = [...main.querySelectorAll("h2")].filter(
    (h) => !h.closest(".visually-hidden-seo"),
  );
  if (heads.length > 2 && !main.querySelector(".ts-toc")) {
    const nav = make("nav", "ts-toc");
    nav.setAttribute("aria-label", t.related);
    heads.forEach((h, i) => {
      if (!h.id) h.id = "section-" + i;
      const a = make("a", "", h.textContent);
      a.href = location.pathname + "#" + h.id;
      nav.append(a);
    });
    const hero = main.querySelector(".hero,.hero-card,.home-world-hero");
    if (hero && !location.pathname.match(/^\/(ko|en|ja|ru|zh-tw)\/$/))
      hero.after(nav);
  }
  // Hero directory: derive filters from actual visible metadata, never guessed classifications.
  const items = [...main.querySelectorAll(".hero-item")];
  if (items.length) {
    const controls = make("div", "ts-controls"),
      input = make("input");
    input.type = "search";
    input.placeholder = t.heroes;
    const filter = make("select"),
      sort = make("select");
    filter.append(option("", t.all));
    const tags = [
      ...new Set(
        items.flatMap((i) =>
          [...i.querySelectorAll(".chip")].map((c) => c.textContent.trim()),
        ),
      ),
    ];
    tags.forEach((v) => filter.append(option(v, v)));
    sort.append(option("", t.original), option("name", t.name));
    const status = make("p", "ts-status");
    status.setAttribute("role", "status");
    const parents = new Map();
    items.forEach((i) => {
      if (!parents.has(i.parentElement)) parents.set(i.parentElement, []);
      parents.get(i.parentElement).push(i);
    });
    function render() {
      const q = input.value.normalize("NFKC").toLocaleLowerCase(lang);
      let shown = 0;
      items.forEach((i) => {
        const matches =
          i.textContent.normalize("NFKC").toLocaleLowerCase(lang).includes(q) &&
          (!filter.value ||
            [...i.querySelectorAll(".chip")].some(
              (c) => c.textContent.trim() === filter.value,
            ));
        i.hidden = !matches;
        if (matches) shown++;
      });
      parents.forEach((list, p) => {
        const ordered =
          sort.value === "name"
            ? [...list].sort((a, b) =>
                (
                  a.querySelector("h5,h3,.hero-name")?.textContent || ""
                ).localeCompare(
                  b.querySelector("h5,h3,.hero-name")?.textContent || "",
                  lang,
                ),
              )
            : list;
        ordered.forEach((i) => p.append(i));
      });
      main.querySelectorAll(".faction-block,.subsection").forEach((b) => {
        if (b.querySelector(".hero-item"))
          b.hidden = ![...b.querySelectorAll(".hero-item")].some(
            (i) => !i.hidden,
          );
      });
      status.textContent = shown + " " + t.results;
    }
    controls.append(
      field(t.search, input),
      field(t.filter, filter),
      field(t.sort, sort),
      button(t.reset, () => {
        input.value = "";
        filter.value = "";
        sort.value = "";
        render();
      }),
    );
    const host =
      main.querySelector(".faction-tabs") ||
      items[0].closest(".section-card")?.querySelector(".section-head") ||
      items[0].parentElement;
    host.before(controls, status);
    input.addEventListener("input", render);
    filter.addEventListener("change", render);
    sort.addEventListener("change", render);
    render();
  }
  // Every data table remains intact. Selected-row summaries make wide tables usable on phones.
  main.querySelectorAll("table[data-explore]").forEach((table, index) => {
    if (table.hasAttribute('data-workbench')) return;
    const rows = [...table.querySelectorAll("tbody tr")].filter(
      (r) => r.querySelectorAll("td").length >= 2,
    );
    if (rows.length < 2) return;
    const headers = [...table.querySelectorAll("thead tr:first-child th")].map(
      (c) => c.textContent.trim(),
    );
    if (!headers.length) return;
    // Legacy building templates hide their entire table host on mobile.
    // Enhanced controls and the selected-row view must remain available there.
    table.closest('.desktop-only')?.classList.add('ts-enhanced-host');
    const wrap = table.parentElement,
      controls = make("div", "ts-controls"),
      select = make("select"),
      query = make("input");
    query.type = "search";
    query.placeholder = t.filter;
    rows.forEach((r, i) =>
      select.append(
        option(
          String(i),
          r.cells ? r.cells[0].textContent : r.querySelector("td").textContent,
        ),
      ),
    );
    const card = make("div", "ts-row-panel");
    card.setAttribute("aria-live", "polite");
    // Equipment transition tables have explicit from/to rows and a verifiable source total.
    if (
      location.pathname.includes("/database/exclusive-gear/") &&
      index === 0
    ) {
      const steps = rows
        .map((r) => {
          const cells = [...r.querySelectorAll("td")].map((c) =>
              c.textContent.trim(),
            ),
            m = cells[0].match(/(?:Lv\.?\s*)?(\d+)\s*→\s*(\d+)/i);
          return m ? { level: +m[2], from: +m[1], cells } : null;
        })
        .filter(Boolean);
      const sourceTotal = window.TS_MATH.amount(
        rows[rows.length - 1].children[1].textContent,
      );
      const sum = steps.reduce(
        (n, r) => n + (window.TS_MATH.amount(r.cells[1]) ?? NaN),
        0,
      );
      if (steps.length && sum === sourceTotal) {
        const form = make("form", "ts-controls"),
          from = make("select"),
          to = make("select");
        [steps[0].from, ...steps.map((r) => r.level)].forEach((n) => {
          from.append(option(String(n), String(n)));
          to.append(option(String(n), String(n)));
        });
        to.value = String(steps[steps.length - 1].level);
        const output = make("div", "ts-result");
        output.setAttribute("role", "status");
        output.hidden = true;
        form.append(field(t.current, from), field(t.target, to));
        const calc = make("button", "", t.calculate);
        calc.type = "submit";
        const copy = copyControl(() => output.textContent);
        copy.hidden = true;
        form.append(calc, copy);
        form.addEventListener("submit", () => (copy.hidden = false));
        wrap.before(form, output);
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          output.hidden = false;
          try {
            const result = window.TS_MATH.sumRange(
              steps,
              +from.value,
              +to.value,
              [1],
              -1,
            );
            output.textContent =
              headers[1] +
              ": " +
              result.totals[0].toLocaleString(lang) +
              "\n" +
              t.source;
          } catch {
            output.textContent = t.unknown;
          }
        });
      }
    }
    function selectRow() {
      card.replaceChildren();
      const list = make("dl", "ts-row-card");
      card.append(list);
      rows.forEach((r, i) =>
        r.classList.toggle("ts-selected", i === +select.value),
      );
      const cells = [...rows[+select.value].querySelectorAll("td")];
      cells.forEach((c, i) => {
        const pair = make("div");
        pair.append(
          make("dt", "", headers[i] || String(i + 1)),
          make("dd", "", c.textContent.trim()),
        );
        list.append(pair);
      });
    }
    controls.append(
      field(t.row, select),
      field(t.filter, query),
      button(t.reset, () => {
        query.value = "";
        rowStatus.textContent = "";
        rows.forEach((r) => (r.hidden = false));
        select.value = "0";
        const sort = controls.querySelector("[data-table-sort]");
        if (sort) {
          sort.value = "";
          sort.dispatchEvent(new Event("change"));
        }
        selectRow();
      }),
    );
    wrap.before(controls, card);
    select.addEventListener("change", () => {
      selectRow();
      view(0);
    });
    const rowStatus = make("p", "ts-status");
    rowStatus.setAttribute("role", "status");
    controls.after(rowStatus);
    query.addEventListener("input", () => {
      const q = query.value.toLocaleLowerCase(lang);
      rows.forEach(
        (r) => (r.hidden = !r.textContent.toLocaleLowerCase(lang).includes(q)),
      );
      rowStatus.textContent =
        rows.filter((r) => !r.hidden).length + " " + t.results;
      view(1);
    });
    selectRow();
    const tabs = make("div", "ts-view-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", t.table);
    card.id = "ts-row-" + index;
    wrap.id = "ts-table-" + index;
    card.setAttribute("role", "tabpanel");
    wrap.setAttribute("role", "tabpanel");
    function view(which) {
      card.hidden = which !== 0;
      wrap.hidden = which !== 1;
      [...tabs.children].forEach((b, i) => {
        b.setAttribute("aria-selected", String(i === which));
        b.tabIndex = i === which ? 0 : -1;
      });
    }
    [t.row, t.table].forEach((label, i) => {
      const b = button(label, () => view(i));
      b.id = "ts-view-" + index + "-" + i;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", i === 0 ? card.id : wrap.id);
      (i === 0 ? card : wrap).setAttribute("aria-labelledby", b.id);
      b.addEventListener("keydown", (e) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const next = e.key === "Home" ? 0 : e.key === "End" ? 1 : 1 - i;
          view(next);
          tabs.children[next].focus();
        }
      });
      tabs.append(b);
    });
    controls.after(tabs);
    view(innerWidth <= 768 ? 0 : 1);
    // Sort only rectangular, unmerged tables; source HTML order remains the reset order.
    if (
      rows.every(
        (r) =>
          r.querySelectorAll("td").length === headers.length &&
          !r.querySelector("[rowspan],[colspan]"),
      )
    ) {
      const sort = make("select");
      sort.setAttribute("data-table-sort", "");
      sort.append(option("", t.original));
      headers.forEach((h, i) =>
        sort.append(option(String(i), h + " ↑"), option(i + "-desc", h + " ↓")),
      );
      controls.append(field(t.sort, sort));
      sort.addEventListener("change", () => {
        view(1);
        const i = parseInt(sort.value, 10),
          direction = sort.value.endsWith("-desc") ? -1 : 1;
        const list =
          sort.value === ""
            ? rows
            : [...rows].sort((a, b) => {
                const x = a.children[i].textContent.trim(),
                  y = b.children[i].textContent.trim(),
                  nx = window.TS_MATH.amount(x),
                  ny = window.TS_MATH.amount(y);
                return (
                  direction *
                  (nx !== null && ny !== null
                    ? nx - ny
                    : x.localeCompare(y, lang, { numeric: true }))
                );
              });
        list.forEach((r) => r.parentElement.append(r));
        table
          .querySelectorAll("thead th")
          .forEach((th, j) =>
            th.setAttribute(
              "aria-sort",
              sort.value !== "" && j === i
                ? direction === 1
                  ? "ascending"
                  : "descending"
                : "none",
            ),
          );
      });
    }
    // Building tables use existing target-level costs. Unknown dashes are not silently zeroed.
    if (
      index === 0 &&
      location.pathname.includes("/buildings/") &&
      headers.length === 8 &&
      rows.every((r) => /^\d+$/.test(r.querySelector("td").textContent.trim()))
    ) {
      const data = rows.map((r) => ({
        level: +r.children[0].textContent,
        cells: [...r.children].map((c) => c.textContent.trim()),
      }));
      const form = make("form", "ts-controls"),
        from = make("select"),
        to = make("select");
      data.forEach((r) => {
        from.append(option(String(r.level), String(r.level)));
        to.append(option(String(r.level), String(r.level)));
      });
      to.value = String(data[Math.min(1, data.length - 1)].level);
      const output = make("div", "ts-result");
      output.setAttribute("role", "status");
      output.hidden = true;
      form.append(field(t.current, from), field(t.target, to));
      const calc = make("button", "", t.calculate);
      calc.type = "submit";
      const copy = copyControl(() => output.textContent);
      copy.hidden = true;
      form.append(calc, copy);
      form.addEventListener("submit", () => (copy.hidden = false));
      const note = make("p", "ts-status", t.source);
      controls.before(form, note, output);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        output.hidden = false;
        output.classList.remove("ts-updated");
        try {
          const result = window.TS_MATH.sumRange(
            data,
            +from.value,
            +to.value,
            [2, 3, 4, 5],
            6,
          );
          output.textContent =
            t.total +
            "\n" +
            result.totals
              .map((n, i) => headers[i + 2] + ": " + n.toLocaleString(lang))
              .join("\n") +
            "\n" +
            t.time +
            ": " +
            Math.floor(result.time / 1440) +
            "d " +
            Math.floor((result.time % 1440) / 60) +
            "h " +
            (result.time % 60) +
            "m";
          select.value = String(data.findIndex((r) => r.level === +to.value));
          selectRow();
          rows.forEach((r) =>
            r.classList.toggle(
              "ts-selected",
              +r.children[0].textContent > +from.value &&
                +r.children[0].textContent <= +to.value,
            ),
          );
        } catch {
          output.textContent = t.unknown + " " + t.current + " ≤ " + t.target;
        }
        output.classList.add("ts-updated");
      });
    }
  });
  // Search existing research and event articles without inventing schedules or costs.
  if (
    location.pathname.endsWith("/buildings/lab/") ||
    location.pathname.endsWith("/events/")
  ) {
    const cards = [
      ...main.querySelectorAll(".priority-card,.info-card,.content-card"),
    ];
    if (cards.length) {
      const controls = make("div", "ts-controls"),
        input = make("input"),
        status = make("p", "ts-status");
      input.type = "search";
      status.setAttribute("role", "status");
      function filter() {
        const q = input.value.normalize("NFKC").toLocaleLowerCase(lang);
        let count = 0;
        cards.forEach((c) => {
          c.hidden = !c.textContent
            .normalize("NFKC")
            .toLocaleLowerCase(lang)
            .includes(q);
          if (!c.hidden) count++;
        });
        status.textContent = count + " " + t.results;
      }
      controls.append(
        field(t.search, input),
        button(t.reset, () => {
          input.value = "";
          filter();
        }),
      );
      cards[0].parentElement.before(controls, status);
      input.addEventListener("input", filter);
      filter();
    }
  }
  // Copy existing gift codes without altering code values or expiry claims.
  if (
    location.pathname.includes("/codes/") ||
    location.pathname.match(/^\/(ko|en|ja|ru|zh-tw)\/$/)
  )
    main.querySelectorAll("code").forEach((code) => {
      if (
        /^[A-Z0-9_-]{3,40}$/.test(code.textContent.trim()) &&
        !code.nextElementSibling?.matches("button")
      )
        code.after(copyControl(() => code.textContent.trim()));
    });
})();
