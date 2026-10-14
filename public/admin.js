const loginForm = document.querySelector("#admin-login");
const tokenInput = document.querySelector("#admin-token");
const statusMessage = document.querySelector("#admin-status");
const wishList = document.querySelector("#wish-list");

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function renderWishes(wishes) {
  wishList.replaceChildren();
  if (wishes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-inbox";
    empty.textContent = "No birthday wishes yet. They'll show up here when someone sends one.";
    wishList.append(empty);
    return;
  }

  wishes.forEach((wish) => {
    const entry = document.createElement("article");
    entry.className = "wish-entry";
    const header = document.createElement("header");
    const name = document.createElement("h2");
    name.textContent = wish.name;
    const date = document.createElement("time");
    date.dateTime = wish.createdAt;
    date.textContent = formatDate(wish.createdAt);
    const message = document.createElement("p");
    message.textContent = wish.wish;
    header.append(name, date);
    entry.append(header, message);
    wishList.append(entry);
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusMessage.textContent = "Loading wishes...";
  wishList.replaceChildren();

  try {
    const response = await fetch("/api/wishes", {
      headers: { Authorization: `Bearer ${tokenInput.value.trim()}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The wishes inbox couldn't be opened.");
    renderWishes(result.wishes);
    statusMessage.textContent = `${result.wishes.length} ${result.wishes.length === 1 ? "wish" : "wishes"} saved`;
  } catch (error) {
    statusMessage.textContent = error.message || "Connection failed. Please try again.";
  }
});
