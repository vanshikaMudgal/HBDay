const images = window.BIRTHDAY_IMAGES || {};
document.querySelectorAll("[data-image]").forEach((image) => {
  const source = images[image.dataset.image];
  if (source) {
    image.src = source.src;
    image.alt = source.alt;
  }
});

const wishDialog = document.querySelector("#wish-dialog");
const wishForm = document.querySelector("#wish-form");
const wishStatus = document.querySelector("#wish-message-status");
const wishSubmit = wishForm.querySelector('[type="submit"]');

document.querySelectorAll("[data-open-wish]").forEach((button) => {
  button.addEventListener("click", () => {
    wishStatus.textContent = "";
    wishStatus.classList.remove("success");
    wishDialog.showModal();
    window.setTimeout(() => document.querySelector("#wish-message").focus(), 0);
  });
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

wishForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  wishStatus.textContent = "";
  wishStatus.classList.remove("success");
  wishSubmit.disabled = true;

  const data = new FormData(wishForm);
  try {
    const response = await fetch("/api/wishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.get("name"), wish: data.get("wish") }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Your wish couldn't be sent.");
    wishStatus.textContent = "Your wish is safely tucked away. Thank you!";
    wishStatus.classList.add("success");
    wishForm.reset();
  } catch (error) {
    wishStatus.textContent = error.message || "Connection failed. Please try again.";
  } finally {
    wishSubmit.disabled = false;
  }
});
