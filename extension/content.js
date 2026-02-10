chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getProductInfo") {
    const hostname = window.location.hostname;
    let store = null;
    let priceElement = null;

    if (hostname.includes("woolworths.com.au")) {
      store = "Woolworths";
      priceElement = document.querySelector('.product-price_component_price-lead__vlm8f');
    } else if (hostname.includes("coles.com.au")) {
      store = "Coles";
      priceElement = document.querySelector('.price__value[data-testid="pricing"]');
    }

    const titleElement = document.querySelector("h1");
    const title = titleElement ? titleElement.textContent.trim() : null;
    const price = priceElement ? priceElement.textContent.trim() : null;

    if (store && price) {
      const storageKey = store === "Woolworths" ? "woolworthsPrice" : "colesPrice";
      chrome.storage.local.set({ [storageKey]: price });
    }

    sendResponse({ store, title, price });
  }
  return true;
});
