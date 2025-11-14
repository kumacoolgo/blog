// public/app.js
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

// --- 全局 UI 控制 ---
const $loader = $("#loader");
const $errorToast = $("#error-toast");
let errorTimer;

function showLoader() {
  $loader.classList.remove("hidden");
}
function hideLoader() {
  $loader.classList.add("hidden");
}

function showError(message) {
  $errorToast.textContent = message;
  $errorToast.classList.add("show");
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    $errorToast.classList.remove("show");
  }, 3000);
}
// --- UI 控制结束 ---

const state = {
  authed: false,
  profile: {
    name: "Your Name",
    bio: "这里是简介",
    avatarUrl: "/default-avatar.png",
    backgroundUrl: ""
  },
  links: []
};

// 包一层 API 调用：自动处理 loading & 错误
async function api(path, opts = {}) {
  showLoader();
  try {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...opts
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return res.json();
  } catch (err) {
    showError(err.message || "操作失败");
    throw err;
  } finally {
    hideLoader();
  }
}

// 上传图片到 /api/upload
async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);

  showLoader();
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: fd,
      credentials: "include"
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return res.json(); // { url }
  } catch (err) {
    showError(err.message || "上传失败");
    throw err;
  } finally {
    hideLoader();
  }
}

function render() {
  // 顶部
  $("#profile-name").textContent = state.profile.name || "YourName";
  $("#display-name").textContent = state.profile.name || "Your Name";
  $("#bio").textContent = state.profile.bio || "";
  $("#avatar").src =
    state.profile.avatarUrl || "/default-avatar.png";
  $("#bg").style.setProperty(
    "--bg",
    state.profile.backgroundUrl
      ? `url(${state.profile.backgroundUrl})`
      : "#f3f4f6"
  );

  // 登录按钮/用户菜单
  $("#login-btn").classList.toggle("hidden", state.authed);
  $("#user-menu").classList.toggle("hidden", !state.authed);
  $("#edit-profile").classList.toggle("hidden", !state.authed);
  $("#add-link").classList.toggle("hidden", !state.authed);

  // 列表
  const ul = $("#links");
  ul.innerHTML = "";
  state.links.forEach((link) => {
    const li = document.createElement("li");
    li.className = "link-item";
    li.draggable = state.authed; // 登录后可拖拽
    li.dataset.id = link.id;
    li.innerHTML = `
      <div class="link-left">
        <div class="icon">${renderIcon(link.icon)}</div>
        <div class="meta">
          <div class="title">${escapeHtml(link.title)}</div>
          <div class="url">${escapeHtml(link.url)}</div>
        </div>
      </div>
      <div class="link-right">
        ${
          state.authed
            ? '<button class="btn small edit-btn">编辑</button>'
            : ""
        }
        <a class="btn small" href="${link.url}" target="_blank" rel="noopener">打开</a>
      </div>`;

    if (state.authed) {
      $(".edit-btn", li).addEventListener("click", () =>
        openLinkDialog(link)
      );
      setupDragReorder(li);
    }

    ul.appendChild(li);
  });
}

function renderIcon(icon) {
  if (!icon) return "🔗";
  if (/^https?:\/\//.test(icon)) return `<img src="${icon}" alt="" />`;
  return escapeHtml(icon);
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (c) =>
    (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }
    )[c]
  );
}

function setupDragReorder(el) {
  let pressTimer;
  el.addEventListener(
    "touchstart",
    () => {
      pressTimer = setTimeout(() => (el.draggable = true), 300);
    },
    { passive: true }
  );
  el.addEventListener("touchend", () => {
    clearTimeout(pressTimer);
    setTimeout(() => (el.draggable = false), 0);
  });

  el.addEventListener("dragstart", (e) => {
    el.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  el.addEventListener("dragend", async () => {
    el.classList.remove("dragging");
    try {
      await persistOrder();
    } catch {
      // 错误在 api() 内部已经提示
    }
  });

  $("#links").addEventListener("dragover", (e) => {
    e.preventDefault();
    const container = $("#links");
    const afterEl = getDragAfterElement(container, e.clientY);
    const dragging = $(".dragging");
    if (!dragging) return;
    if (afterEl == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterEl);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".link-item:not(.dragging)")
  ];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else return closest;
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

async function persistOrder() {
  const ids = $$("#links .link-item").map((li) => li.dataset.id);
  await api("/api/links", {
    method: "PATCH",
    body: JSON.stringify({ order: ids })
  });
  await load();
}

async function load() {
  const data = await api("/api/me");
  state.authed = data.authed;
  state.profile = data.profile;
  state.links = data.links;
  $("#logged-name").textContent = state.profile.name || "";
  render();
}

// 登录
$("#login-btn").addEventListener("click", () =>
  $("#login-dialog").showModal()
);
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(fd))
    });
    $("#login-dialog").close();
    await load();
  } catch {
    // 错误由 api() 统一处理
  }
});

$("#logout-btn").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
    await load();
  } catch {
    // 错误由 api() 统一处理
  }
});

// 编辑资料
$("#edit-profile").addEventListener("click", () => {
  const d = $("#profile-dialog");
  $('input[name="name"]', d).value = state.profile.name || "";
  $('textarea[name="bio"]', d).value = state.profile.bio || "";
  $('input[name="avatarUrl"]', d).value = state.profile.avatarUrl || "";
  $('input[name="backgroundUrl"]', d).value =
    state.profile.backgroundUrl || "";
  d.showModal();
});

$("#avatarFile")?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const { url } = await uploadFile(f);
    $('input[name="avatarUrl"]').value = url;
  } catch {
    // 错误由 uploadFile() 统一处理
  }
});

$("#bgFile")?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const { url } = await uploadFile(f);
    $('input[name="backgroundUrl"]').value = url;
  } catch {
    // 错误由 uploadFile() 统一处理
  }
});

$("#profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const payload = Object.fromEntries(fd);
  try {
    await api("/api/profile", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    $("#profile-dialog").close();
    await load();
  } catch {
    // 错误由 api() 统一处理
  }
});

// 添加/编辑链接
$("#add-link").addEventListener("click", () => openLinkDialog());

function openLinkDialog(link = {}) {
  const d = $("#link-dialog");
  $('input[name="id"]', d).value = link.id || "";
  $('input[name="icon"]', d).value = link.icon || "";
  $('input[name="title"]', d).value = link.title || "";
  $('input[name="url"]', d).value = link.url || "";
  d.showModal();

  $("#delete-link").onclick = async () => {
    if (!link.id) return d.close();
    if (confirm("确定删除？")) {
      try {
        await api("/api/links", {
          method: "DELETE",
          body: JSON.stringify({ id: link.id })
        });
        d.close();
        await load();
      } catch {
        // 错误由 api() 统一处理
      }
    }
  };

  $("#iconFile")?.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { url } = await uploadFile(f);
      $('input[name="icon"]').value = url;
    } catch {
      // 错误由 uploadFile() 统一处理
    }
  });
}

$("#link-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const payload = Object.fromEntries(fd);
  const body = JSON.stringify({
    id: payload.id || undefined,
    icon: payload.icon,
    title: payload.title,
    url: payload.url
  });
  try {
    await api("/api/links", {
      method: payload.id ? "PUT" : "POST",
      body
    });
    $("#link-dialog").close();
    await load();
  } catch {
    // 错误由 api() 统一处理
  }
});

// 启动
load().catch((err) => {
  console.error(err);
  showError("初始化加载失败，请刷新页面");
});
