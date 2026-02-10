chrome.storage.local.get(["claudeApiKey"], (result) => {
  if (result.claudeApiKey) {
    document.getElementById("apiKey").value = result.claudeApiKey;
  }
});

document.getElementById("apiKey").addEventListener("change", (e) => {
  chrome.storage.local.set({ claudeApiKey: e.target.value });
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentTab = tabs[0];

  if (!currentTab.url.includes("woolworths.com.au") && !currentTab.url.includes("coles.com.au")) {
    document.getElementById("store").textContent = "Not a supported page";
    document.getElementById("store").className = "value error";
    document.getElementById("title").textContent = "-";
    document.getElementById("price").textContent = "-";
    return;
  }

  chrome.tabs.sendMessage(
    currentTab.id,
    { action: "getProductInfo" },
    (response) => {
      if (chrome.runtime.lastError) {
        document.getElementById("store").textContent = "Error: Could not connect to page";
        document.getElementById("store").className = "value error";
        document.getElementById("title").textContent = "-";
        document.getElementById("price").textContent = "-";
        return;
      }

      const store = response.store || "Unknown";
      const title = response.title || "Product title not found";
      const price = response.price || "Price not found";

      document.getElementById("store").textContent = store;
      document.getElementById("title").textContent = title;
      document.getElementById("price").textContent = price;

      if (store === "Woolworths" && title !== "Product title not found" && price !== "Price not found") {
        triggerAutoMatch(title, price);
      }

      chrome.storage.local.get(["woolworthsPrice", "colesPrice"], (result) => {
        const woolworthsPrice = result.woolworthsPrice;
        const colesPrice = result.colesPrice;

        if (woolworthsPrice && colesPrice) {
          showComparison(woolworthsPrice, colesPrice);
        }
      });
    }
  );
});

function triggerAutoMatch(productTitle, woolworthsPrice) {
  const apiKey = document.getElementById("apiKey").value;

  if (!apiKey) {
    document.getElementById("autoMatch").style.display = "block";
    document.getElementById("autoMatchResult").textContent = "Please enter Claude API key above";
    document.getElementById("autoMatchResult").className = "value error";
    return;
  }

  document.getElementById("autoMatch").style.display = "block";
  document.getElementById("autoMatchResult").textContent = "Searching Coles for matching product...";
  document.getElementById("autoMatchResult").className = "value loading";

  chrome.runtime.sendMessage(
    {
      action: "findColesMatch",
      productTitle: productTitle,
      woolworthsPrice: woolworthsPrice,
      apiKey: apiKey
    },
    (result) => {
      if (result.error) {
        document.getElementById("autoMatchResult").textContent = `Error: ${result.error}`;
        document.getElementById("autoMatchResult").className = "value error";
        return;
      }

      if (!result.colesProduct) {
        document.getElementById("autoMatchResult").textContent = "No close Coles match found";
        document.getElementById("autoMatchResult").className = "value";
        return;
      }

      const matchHtml = `
        <strong>${result.colesProduct}</strong><br>
        ${result.colesPrice}<br>
        <span class="confidence">Confidence: ${result.confidence}% - ${result.reason}</span>
      `;

      document.getElementById("autoMatchResult").innerHTML = matchHtml;
      document.getElementById("autoMatchResult").className = "value";

      showComparison(result.woolworthsPrice, result.colesPrice);
    }
  );
}

function showComparison(woolworthsPrice, colesPrice) {
  const woolworthsValue = parseFloat(woolworthsPrice.replace(/[^0-9.]/g, ''));
  const colesValue = parseFloat(colesPrice.replace(/[^0-9.]/g, ''));

  let comparisonText = `Woolworths: ${woolworthsPrice} | Coles: ${colesPrice}`;

  if (woolworthsValue < colesValue) {
    comparisonText += '<br><span class="cheaper">Woolworths is cheaper</span>';
  } else if (colesValue < woolworthsValue) {
    comparisonText += '<br><span class="cheaper">Coles is cheaper</span>';
  } else {
    comparisonText += '<br>Same price';
  }

  document.getElementById("comparisonText").innerHTML = comparisonText;
  document.getElementById("comparison").style.display = "block";
}
