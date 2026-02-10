chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "findColesMatch") {
    handleColesMatch(request.productTitle, request.woolworthsPrice, request.apiKey)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

async function handleColesMatch(productTitle, woolworthsPrice, apiKey) {
  if (!apiKey) {
    return { error: "Claude API key not set" };
  }

  const candidates = await fetchColesCandidates(productTitle);

  if (candidates.length === 0) {
    return { error: "No Coles products found" };
  }

  const match = await findBestMatch(productTitle, candidates, apiKey);

  return {
    woolworthsPrice,
    colesProduct: match.product,
    colesPrice: match.price,
    confidence: match.confidence,
    reason: match.reason
  };
}

async function fetchColesCandidates(productTitle) {
  const searchUrl = `https://www.coles.com.au/search?q=${encodeURIComponent(productTitle)}`;

  try {
    const response = await fetch(searchUrl);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const products = [];
    const productElements = doc.querySelectorAll('section[data-testid="product-tile"]');

    for (let i = 0; i < Math.min(productElements.length, 5); i++) {
      const element = productElements[i];

      const nameElement = element.querySelector('h2');
      const priceElement = element.querySelector('[data-testid="price"]');

      if (nameElement && priceElement) {
        products.push({
          name: nameElement.textContent.trim(),
          price: priceElement.textContent.trim()
        });
      }
    }

    return products;
  } catch (error) {
    console.error("Error fetching Coles search:", error);
    return [];
  }
}

async function findBestMatch(woolworthsProduct, colesCandidates, apiKey) {
  const candidateList = colesCandidates
    .map((c, i) => `${i + 1}. ${c.name} - ${c.price}`)
    .join('\n');

  const prompt = `You are matching grocery products.

Woolworths product: ${woolworthsProduct}

Coles candidates:
${candidateList}

Return ONLY a JSON object with this exact format:
{
  "matchIndex": <number 1-${colesCandidates.length} or 0 if no good match>,
  "confidence": <number 0-100>,
  "reason": "<short reason>"
}

Select the best matching product based on product name similarity. If no good match exists (confidence below 50), set matchIndex to 0.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse Claude response");
    }

    const result = JSON.parse(jsonMatch[0]);

    if (result.matchIndex === 0 || result.confidence < 50) {
      return {
        product: null,
        price: null,
        confidence: result.confidence,
        reason: result.reason
      };
    }

    const matched = colesCandidates[result.matchIndex - 1];
    return {
      product: matched.name,
      price: matched.price,
      confidence: result.confidence,
      reason: result.reason
    };

  } catch (error) {
    console.error("Error calling Claude API:", error);
    throw error;
  }
}
