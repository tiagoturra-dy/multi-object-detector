/* ============================================================
   APP  (IIFE – no globals leaked beyond CONFIG)
   ============================================================ */
(function () {
  "use strict";

  /* ──────── API CONFIGURATION ──────── */
  const CONFIG = {
    api: {
      detectUrl: "${Detection Endpoint}",
      detectFileField: "file",
      searchUrl: "${Search API Endpoint}",
      apiKey: '${API Key}',
    },

    /* ──────── UI CONFIGURATION ──────── */
    ui: {
      maxFileSizeBytes: 10 * 1024 * 1024,
      dotSizePx: 22,
      boxStrokeStyle: "rgba(255,255,255,0.9)",
      boxLineWidth: 2,
      boxPaddingPx: 50,
      loadingMessage: "Loading…",
    },

    /* ──────── GALLERY CONFIGURATION ──────── */
    gallery: {
      images: [
        "${Suggested Image 1}",
        "${Suggested Image 2}",
        "${Suggested Image 3}",
        "${Suggested Image 4}"
      ],
    },

    /* ──────── ELEMENT IDs ──────── */
    elements: {
      overlay: "dy-img-search-${dyVariationId}",
      dyCloseButton: '.dy_full_width_notifications_container:has(#dy-img-search-${dyVariationId}) .dy-full-width-notifications-close',
      fileInput: "fileInput",
      browseBtn: "browseBtn",
      dropzone: "dropzone",
      urlInput: "urlInput",
      searchUrlBtn: "searchUrlBtn",
      apiUrl: "apiUrl",
      gallery: "gallery",
      resultView: "resultView",
      resultImg: "resultImg",
      overlayCanvas: "overlayCanvas",
      dotsContainer: "dotsContainer",
      cropBtn: "cropBtn",
      cropOverlay: "cropOverlay",
      cropBox: "cropBox",
      newSearchBtn: "newSearchBtn",
      imageWrapper: "imageWrapper",
      resultProducts: "resultProducts",
      newUploadBtn: "newUploadBtn",
      sortSelect: "sortSelect",
      filtersContainer: "filtersContainer",
      spinner: "spinner",
      closeWrapper: "closeWrapper",
    },
  };

  /* ────────────────────────── STATE ──────────────────────────── */
  let currentItems = [];    // detected objects returned by the API
  let currentSlots = [];    // current product slots from DY
  let currentFacets = [];   // current facets from DY
  let activeIndex  = null;  // index of the selected dot
  let cropActive   = false; // whether crop mode is on
  let lastImageBase64 = null; // last image used for search
  let selectedFilters = {}; // tracks selected facet values by field name

  // Scale and offset factors (for coordinate mapping)
  let scaleX = 1, scaleY = 1;
  let offsetX = 0, offsetY = 0;

  // Crop drag / resize state
  let cropDragging = false;
  let cropResizing = null;
  let cropStartX   = 0;
  let cropStartY   = 0;
  let cropRect     = { x: 0, y: 0, w: 0, h: 0 };

  /* ────────────────────────── ELEMENT REFS ──────────────────────── */
  /* Helper to get overlay - queries fresh each time in case React remounts it */
  function getOverlay() {
    return document.getElementById(CONFIG.elements.overlay);
  }
  
  function getPanel() {
    const ov = getOverlay();
    return ov ? ov.querySelector('.dy-panel') : null;
  }
  
  function getFileInput() {
    const ov = getOverlay();
    return ov ? ov.querySelector('#' + CONFIG.elements.fileInput) : null;
  }
  
  function getBrowseBtn() {
    const ov = getOverlay();
    return ov ? ov.querySelector('#' + CONFIG.elements.browseBtn) : null;
  }
  
  function getDropzone() {
    const ov = getOverlay();
    return ov ? ov.querySelector('#' + CONFIG.elements.dropzone) : null;
  }
  
  function getUrlInput() {
    const ov = getOverlay();
    return ov ? ov.querySelector('#' + CONFIG.elements.urlInput) : null;
  }
  
  function getSearchUrlBtn() {
    const ov = getOverlay();
    return ov ? ov.querySelector('#' + CONFIG.elements.searchUrlBtn) : null;
  }
  
  function getGalleryEl() {
    const ov = getOverlay();
    return ov ? ov.querySelector('#' + CONFIG.elements.gallery) : null;
  }
  
  let overlay = getOverlay();
  let panel = null;
  let resultView = null;

  // Attach listeners to upload/browse elements
  function attachUploadListeners() {
    const browseBtn = getBrowseBtn();
    const fileInput = getFileInput();
    const dropzone = getDropzone();
    if (!browseBtn || !fileInput || !dropzone) return;
    
    if (!browseBtn._uploadListenerAttached) {
      browseBtn._uploadListenerAttached = true;
      browseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }
    
    if (!dropzone._uploadListenerAttached) {
      dropzone._uploadListenerAttached = true;
      dropzone.addEventListener("click", () => fileInput.click());
    }
  }
  
  // Attach listeners to file input and URL input
  function attachFileChangeListeners() {
    const fileInput = getFileInput();
    const dropzone = getDropzone();
    const urlInput = getUrlInput();
    const searchUrlBtn = getSearchUrlBtn();
    
    if (fileInput && !fileInput._changeListenerAttached) {
      fileInput._changeListenerAttached = true;
      fileInput.addEventListener("change", () => {
        if (fileInput.files.length) processFile(fileInput.files[0]);
      });
    }
    
    if (dropzone && !dropzone._dragListenerAttached) {
      dropzone._dragListenerAttached = true;
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dy-drag-over");
      });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dy-drag-over"));
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dy-drag-over");
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) processFile(file);
      });
    }
    
    if (searchUrlBtn && !searchUrlBtn._clickListenerAttached) {
      searchUrlBtn._clickListenerAttached = true;
      searchUrlBtn.addEventListener("click", () => {
        const urlInput = getUrlInput();
        const url = urlInput.value.trim();
        if (url) loadFromUrl(url);
      });
    }
    
    if (urlInput && !urlInput._keyListenerAttached) {
      urlInput._keyListenerAttached = true;
      urlInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const searchUrlBtn = getSearchUrlBtn();
          searchUrlBtn.click();
        }
      });
    }
  }

  /* Result view elements (lazy-loaded after resultView is set) */
  let resultImg, overlayCanvas, dotsContainer, cropBtn, cropOverlay, cropBox;
  let newSearchBtn, imageWrapper, resultProducts, newUploadBtn, sortSelect;
  
  function initResultViewElements() {
    if (!resultView) {
      const currentOverlay = getOverlay();
      if (!currentOverlay) {
        console.error("Overlay element not found");
        return;
      }
      resultView = currentOverlay.querySelector('#' + CONFIG.elements.resultView);
      if (!resultView) {
        console.error("resultView element not found with ID:", CONFIG.elements.resultView);
        return;
      }
    }
    if (resultView) {
      resultImg = resultView.querySelector('#' + CONFIG.elements.resultImg);
      overlayCanvas = resultView.querySelector('#' + CONFIG.elements.overlayCanvas);
      dotsContainer = resultView.querySelector('#' + CONFIG.elements.dotsContainer);
      cropBtn = resultView.querySelector('#' + CONFIG.elements.cropBtn);
      cropOverlay = resultView.querySelector('#' + CONFIG.elements.cropOverlay);
      cropBox = resultView.querySelector('#' + CONFIG.elements.cropBox);
      newSearchBtn = resultView.querySelector('#' + CONFIG.elements.newSearchBtn);
      imageWrapper = resultView.querySelector('#' + CONFIG.elements.imageWrapper);
      resultProducts = resultView.querySelector('#' + CONFIG.elements.resultProducts);
      newUploadBtn = resultView.querySelector('#' + CONFIG.elements.newUploadBtn);
      sortSelect = resultView.querySelector('#' + CONFIG.elements.sortSelect);
      
      // Debug: log any missing elements
      [
        ['resultImg', resultImg],
        ['overlayCanvas', overlayCanvas],
        ['dotsContainer', dotsContainer],
        ['cropBtn', cropBtn],
        ['cropOverlay', cropOverlay],
        ['cropBox', cropBox],
        ['newSearchBtn', newSearchBtn],
        ['imageWrapper', imageWrapper],
        ['resultProducts', resultProducts],
        ['newUploadBtn', newUploadBtn],
        ['sortSelect', sortSelect]
      ].forEach(function(pair) {
        if (!pair[1]) console.warn("Missing element:", pair[0]);
      });
    }
  }

  /* ─────────────────────────── GALLERY ─────────────────────────── */
  function initGallery() {
    const galleryEl = getGalleryEl();
    if (!galleryEl) return;
    galleryEl.innerHTML = "";
    CONFIG.gallery.images.forEach((src, i) => {
      const item = document.createElement("div");
      item.className = "dy-gallery-item";
      const img = document.createElement("img");
      img.src = src;
      img.alt = 'Sample ' + (i + 1);
      img.loading = "lazy";
      item.appendChild(img);
      item.addEventListener("click", () => loadFromUrl(src));
      galleryEl.appendChild(item);
    });
  }

  /* ──────────────────────── UPLOAD / URL ────────────────────────── */
  // Event listeners are now dynamically attached via attachUploadListeners() 
  // and attachFileChangeListeners() when overlay is opened
  async function processFile(file) {
    try {
      if (file.size > CONFIG.ui.maxFileSizeBytes) {
        showError('File exceeds the ' + (CONFIG.ui.maxFileSizeBytes / (1024 * 1024)) + ' MB limit.');
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      showResultView(objectUrl);
      await callDetectionApi(file);
    } catch (err) {
      showError(err.message || "Failed to process file");
    }
  }

  async function loadFromUrl(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image: HTTP ' + response.status);
      const blob = await response.blob();
      showResultView(url);
      await callDetectionApi(blob);
    } catch (err) {
      showError(err.message || "Could not load image from URL. Check the address or use a direct image link.");
    }
  }

  /* ───────────────────────── API CALL ───────────────────────────── */
  async function callDetectionApi(fileOrBlob) {
    addSpinner();
    try {
      if (!fileOrBlob) throw new Error("No file provided");
      
      // Convert blob/file to base64
      const base64 = await blobToBase64(fileOrBlob);
      const imageBase64 = base64.split(',')[1];
      if (!imageBase64) throw new Error("Failed to convert image to base64");
      
      lastImageBase64 = imageBase64;

      // Call both detect and search APIs in parallel
      console.log("Calling detect and search APIs...");
      const results = await Promise.allSettled([
        callDetectApi(imageBase64),
        callSearchApi(imageBase64, [])
      ]);

      const detectResult = results[0];
      const searchResult = results[1];

      console.log("API results:", { detectResult, searchResult });
      removeSpinner();

      // Handle detect results - if failed, log error and continue
      let detectResponse = null;
      if (detectResult.status === 'fulfilled') {
        detectResponse = detectResult.value;
        if (detectResponse.items) {
          currentItems = detectResponse.items;
          console.log("Stored currentItems:", currentItems);
        } else {
          console.warn("No items in detectResponse", detectResponse);
        }
      } else {
        console.error("Detect API failed:", detectResult.reason);
        currentItems = [];
      }

      // Handle search results
      if (searchResult.status === 'fulfilled') {
        const searchResponse = searchResult.value;
        if (searchResponse.choices && searchResponse.choices.length > 0) {
          const choice = searchResponse.choices[0];
          const { payload: { data: { slots, facets } } } = choice.variations[0];
          currentSlots = slots;
          currentFacets = facets || [];
          console.log("About to render detections with items:", currentItems);
          renderDetectionsWithDots(currentItems);
          renderFacets(currentFacets);
          renderProducts(currentSlots);
        } else {
          showError("No results found. Try another image.");
        }
      } else {
        console.error("Search API failed:", searchResult.reason);
        showError("Search failed. Please try again.");
      }
    } catch (err) {
      console.error("callDetectionApi error:", err);
      showError(err.message || "Failed to process image");
    }
  }

  async function callDetectApi(imageBase64) {
    const apiUrl = CONFIG.api.detectUrl;
    console.log("Calling detect API at:", apiUrl);
    const formData = new FormData();
formData.append('file', dataURLtoBlob('data:image/jpeg;base64,' + imageBase64));
    
    const response = await fetch(apiUrl, { method: "POST", body: formData });
    if (!response.ok) throw new Error('Detect API: HTTP ' + response.status);
    const result = await response.json();
    console.log("Detect API response:", result);
    return result;
  }

  async function callSearchApi(imageBase64, filters, sortBy = null) {
    const queryObj = {
      imageBase64: imageBase64,
      filters: filters,
    };
    if (sortBy) {
      queryObj.sortBy = sortBy;
    }
    const response = await fetch(CONFIG.api.searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DY-API-Key': CONFIG.api.apiKey,
        'Dy-Explain': 'internal',
      },
      body: JSON.stringify({
        query: queryObj,
        user: {
          dyid: '',
          active_consent_accepted: false,
        },
        context: {
          page: {
            type: 'HOMEPAGE',
            data: [],
            location: window.location.href,
            locale: 'en-US',
            referrer: document.referrer,
          },
          device: {
            userAgent: window.navigator.userAgent,
          },
        },
        session: {
          dy: '',
        },
        selector: {
          name: 'Visual Search',
        },
        options: {
          productData: {
            skusOnly: false,
          },
        },
      }),
    });

    if (!response.ok) throw new Error('Search API: HTTP ' + response.status);
    return await response.json();
  }

  function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      if (!blob || !(blob instanceof Blob)) {
        reject(new Error("Invalid file: expected a Blob or File object"));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(new Error("Error reading file: " + reader.error));
      reader.readAsDataURL(blob);
    });
  }

  /* ──────────────────────── RESULT VIEW ─────────────────────────── */
  function showResultView(imageUrl) {
    initResultViewElements();
    attachCropListeners();
    attachResultViewListeners();
    
    if (!dotsContainer || !overlayCanvas || !cropOverlay || !cropBtn || !resultImg || !resultView) {
      console.error("Cannot show result view: some elements are undefined", {
        dotsContainer: !!dotsContainer,
        overlayCanvas: !!overlayCanvas,
        cropOverlay: !!cropOverlay,
        cropBtn: !!cropBtn,
        resultImg: !!resultImg,
        resultView: !!resultView
      });
      showError("Failed to load result view. Please refresh and try again.");
      return;
    }
    
    currentItems = [];
    activeIndex  = null;
    cropActive   = false;
    selectedFilters = {};

    dotsContainer.innerHTML = "";
    overlayCanvas.getContext("2d").clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    cropOverlay.classList.add("dy-hidden");
    cropBtn.textContent = "Crop";

    resultImg.src = imageUrl;
    const freshPanel = getPanel();
    if (freshPanel) freshPanel.classList.add("dy-hidden");
    resultView.classList.remove("dy-hidden");
  }

  function renderDetections(items) {
    currentItems = items;
    renderDetectionsWithDots(items);
  }

  function renderDetectionsWithDots(items) {
    console.log("renderDetectionsWithDots called with items:", items);
    dotsContainer.innerHTML = "";

    const img = resultImg;

    function onLoad() {
      console.log("Image loaded, renderDetectionsWithDots onLoad executing");
      const displayW = img.clientWidth;
      const displayH = img.clientHeight;
      scaleX = displayW / img.naturalWidth;
      scaleY = displayH / img.naturalHeight;

      // Get the actual position of image within wrapper (accounts for object-fit: contain)
      const imgRect = img.getBoundingClientRect();
      const wrapperRect = dotsContainer.getBoundingClientRect();
      offsetX = imgRect.left - wrapperRect.left;
      offsetY = imgRect.top - wrapperRect.top;

      overlayCanvas.width  = displayW;
      overlayCanvas.height = displayH;
      overlayCanvas.style.width  = displayW + "px";
      overlayCanvas.style.height = displayH + "px";
      overlayCanvas.style.left = offsetX + "px";
      overlayCanvas.style.top = offsetY + "px";

      console.log("Canvas dimensions:", displayW, displayH, "Scale:", scaleX, scaleY, "Offset:", offsetX, offsetY);

      items.forEach((item, idx) => {
        // Skip items marked as hidden (low-confidence duplicates)
        if (item.display === false) return;
        const [x1, y1, x2, y2] = item.box;
        const cx = ((x1 + x2) / 2) * scaleX + offsetX;
        const cy = ((y1 + y2) / 2) * scaleY + offsetY;

        console.log("Creating dot at:", cx, cy, "for item:", item.label);

        const wrapper = document.createElement("div");
        wrapper.className = "dy-detection-dot-wrapper";
        wrapper.style.left = cx + "px";
        wrapper.style.top  = cy + "px";

        const dot = document.createElement("div");
        dot.className = "dy-detection-dot";
        dot.style.width  = CONFIG.ui.dotSizePx + "px";
        dot.style.height = CONFIG.ui.dotSizePx + "px";

        const tooltip = document.createElement("div");
        tooltip.className = "dy-dot-tooltip";
        // tooltip.textContent = item.label + ' (' + Math.round(item.confidence * 100) + '%)';
        tooltip.textContent = item.label;

        wrapper.appendChild(dot);
        wrapper.appendChild(tooltip);
        dotsContainer.appendChild(wrapper);

        wrapper.addEventListener("click", () => {
          selectDot(idx, scaleX, scaleY);
          searchWithCroppedImage(item.box);
        });
      });
      console.log("Dots rendering complete, total dots created:", items.filter(i => i.display !== false).length);
    }

    if (img.complete && img.naturalWidth) {
      console.log("Image already loaded, executing onLoad immediately");
      onLoad();
    } else {
      console.log("Image not loaded yet, attaching load listener");
      img.addEventListener("load", onLoad, { once: true });
    }
  }

  async function searchWithCroppedImage(box) {
    if (!lastImageBase64 || !box) return;
    
    selectedFilters = {}; // reset filters on new search
    addSpinner();
    try {
      const img = resultImg;
      let [x1, y1, x2, y2] = box;
      
      // Apply padding with boundary checks
      const padding = CONFIG.ui.boxPaddingPx;
      x1 = Math.max(0, x1 - padding);
      y1 = Math.max(0, y1 - padding);
      x2 = Math.min(img.naturalWidth, x2 + padding);
      y2 = Math.min(img.naturalHeight, y2 + padding);
      
      const canvas = document.createElement('canvas');
      canvas.width = x2 - x1;
      canvas.height = y2 - y1;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, x1, y1, x2 - x1, y2 - y1, 0, 0, x2 - x1, y2 - y1);
      
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      const searchResponse = await callSearchApi(croppedBase64, []);
      removeSpinner();
      
      if (searchResponse.choices && searchResponse.choices.length > 0) {
        const choice = searchResponse.choices[0];
        const { payload: { data: { slots } } } = choice.variations[0];
        currentSlots = slots;
        renderProducts(currentSlots);
      }
    } catch (err) {
      removeSpinner();
      console.error("Search error:", err);
    }
  }

  function buildFiltersFromSelection() {
    const filters = [];
    Object.entries(selectedFilters).forEach(([field, values]) => {
      if (values && values.length > 0) {
        filters.push({
          field: field,
          values: values,
        });
      }
    });
    return filters;
  }

  async function onFacetValueChange() {
    if (!lastImageBase64) return;
    
    addSpinner();
    try {
      const filters = buildFiltersFromSelection();
      const searchResponse = await callSearchApi(lastImageBase64, filters);
      removeSpinner();
      
      if (searchResponse.choices && searchResponse.choices.length > 0) {
        const choice = searchResponse.choices[0];
        const { payload: { data: { slots } } } = choice.variations[0];
        currentSlots = slots;
        renderProducts(currentSlots);
      }
    } catch (err) {
      removeSpinner();
      showError(err.message || "Failed to filter results");
    }
  }

  function renderFacets(facets) {
    selectedFilters = {}; // reset filters on new facets
    const filtersContainer = document.getElementById("filtersContainer");
    if (!filtersContainer) {
      console.warn("filtersContainer element not found");
      return;
    }
    if (!facets || facets.length === 0) return;
    
    filtersContainer.innerHTML = "";
    
    facets.forEach((facet) => {
      selectedFilters[facet.column] = []; // initialize empty array for this field
      
      const group = document.createElement("div");
      group.className = "dy-filter-group dy-collapsed";
      
      const title = document.createElement("div");
      title.className = "dy-filter-group-title";
      title.textContent = facet.displayName || facet.column;
      title.addEventListener("click", () => {
        filtersContainer.querySelectorAll(".dy-filter-group").forEach(g => g.classList.add("dy-collapsed"));
        group.classList.remove("dy-collapsed");
      });
      group.appendChild(title);
      
      const optionsDiv = document.createElement("div");
      optionsDiv.className = "dy-filter-options";
      
      if (facet.valuesType === "number") {
        const rangeWrapper = document.createElement("div");
        rangeWrapper.className = "dy-filter-range-wrapper";
        
        // Min input group
        const minGroup = document.createElement("div");
        minGroup.className = "dy-filter-range-group";
        const minLabel = document.createElement("label");
        minLabel.className = "dy-filter-range-label";
        minLabel.textContent = "MIN ($)";
        const minInput = document.createElement("input");
        minInput.type = "number";
        minInput.className = "dy-filter-range-input";
        minInput.min = facet.min;
        minInput.max = facet.max;
        minInput.value = facet.min;
        minGroup.appendChild(minLabel);
        minGroup.appendChild(minInput);
        
        // TO text
        const toText = document.createElement("div");
        toText.className = "dy-filter-range-separator";
        toText.textContent = "TO";
        
        // Max input group
        const maxGroup = document.createElement("div");
        maxGroup.className = "dy-filter-range-group";
        const maxLabel = document.createElement("label");
        maxLabel.className = "dy-filter-range-label";
        maxLabel.textContent = "MAX ($)";
        const maxInput = document.createElement("input");
        maxInput.type = "number";
        maxInput.className = "dy-filter-range-input";
        maxInput.min = facet.min;
        maxInput.max = facet.max;
        maxInput.value = facet.max;
        maxGroup.appendChild(maxLabel);
        maxGroup.appendChild(maxInput);
        
        // Add change listeners for both inputs
        const onRangeChange = () => {
          const minVal = parseInt(minInput.value);
          const maxVal = parseInt(maxInput.value);
          if (minVal <= maxVal) {
            selectedFilters[facet.column] = [{ min: minVal, max: maxVal }];
            onFacetValueChange();
          }
        };
        minInput.addEventListener("change", onRangeChange);
        maxInput.addEventListener("change", onRangeChange);
        
        rangeWrapper.appendChild(minGroup);
        rangeWrapper.appendChild(toText);
        rangeWrapper.appendChild(maxGroup);
        optionsDiv.appendChild(rangeWrapper);
      } else if (facet.values) {
        facet.values.forEach((value) => {
          const option = document.createElement("div");
          option.className = "dy-filter-option";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.value = value.name;
          checkbox.dataset.field = facet.column;
          checkbox.addEventListener("change", () => {
            // Update selectedFilters based on checked state
            if (checkbox.checked) {
              if (!selectedFilters[facet.column].includes(value.name)) {
                selectedFilters[facet.column].push(value.name);
              }
            } else {
              selectedFilters[facet.column] = selectedFilters[facet.column].filter(v => v !== value.name);
            }
            // Trigger search with new filters
            onFacetValueChange();
          });
          
          const label = document.createElement("label");
          label.textContent = value.name + " (" + value.count + ")";
          label.style.marginLeft = "6px";
          label.style.cursor = "pointer";
          
          option.appendChild(checkbox);
          option.appendChild(label);
          optionsDiv.appendChild(option);
        });
      }
      
      group.appendChild(optionsDiv);
      filtersContainer.appendChild(group);
    });
  }

  function renderProducts(items) {
    if (!resultProducts) {
      console.error("resultProducts element not initialized");
      return;
    }
    
    resultProducts.innerHTML = "";

    items.forEach((slot) => {
      const product = slot.productData || {};
      const card = document.createElement("div");
      card.className = "dy-product-card";

      const imageDiv = document.createElement("div");
      imageDiv.className = "dy-product-image";

      const img = document.createElement("img");
      img.src = product.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3C/svg%3E";
      img.alt = product.name || "Product";
      img.onerror = () => {
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3C/svg%3E";
      };

      imageDiv.appendChild(img);

      const infoDiv = document.createElement("div");
      infoDiv.className = "dy-product-info";

      const name = document.createElement("div");
      name.className = "dy-product-name";
      name.textContent = product.name || "Product";

      infoDiv.appendChild(name);

      if (product.price) {
        const priceDiv = document.createElement("div");
        priceDiv.className = "dy-product-price";
        
        if (product.sale_price && product.price > product.sale_price) {
          const oldPrice = document.createElement("span");
          oldPrice.style.textDecoration = "line-through";
          oldPrice.style.color = "#999";
          oldPrice.textContent = formatPrice(product.price);
          
          const salePrice = document.createElement("span");
          salePrice.style.marginLeft = "8px";
          salePrice.style.color = "#d32f2f";
          salePrice.textContent = formatPrice(product.sale_price);
          
          priceDiv.appendChild(oldPrice);
          priceDiv.appendChild(salePrice);
        } else {
          priceDiv.textContent = formatPrice(product.price);
        }
        
        infoDiv.appendChild(priceDiv);
      }

      card.appendChild(imageDiv);
      card.appendChild(infoDiv);

      if (product.url) {
        const link = document.createElement("a");
        link.href = product.url;
        link.target = "_blank";
        link.style.textDecoration = "none";
        link.style.color = "inherit";
        link.appendChild(card);
        resultProducts.appendChild(link);
      } else {
        resultProducts.appendChild(card);
      }
    });
  }

  function formatPrice(price) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  }

  function selectDot(idx, scaleX, scaleY) {
    activeIndex = idx;
    dotsContainer
      .querySelectorAll(".dy-detection-dot-wrapper")
      .forEach((w, i) => w.classList.toggle("active", i === idx));
    drawBoxes(scaleX, scaleY);
  }

  function drawBoxes(scaleX, scaleY) {
    const ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    currentItems.forEach((item, idx) => {
      if (idx !== activeIndex) return;
      let [x1, y1, x2, y2] = item.box;
      console.log("drawBoxes - Original box:", x1, y1, x2, y2);
      
      // Apply padding with boundary checks
      const padding = CONFIG.ui.boxPaddingPx;
      const img = resultImg;
      x1 = Math.max(0, x1 - padding);
      y1 = Math.max(0, y1 - padding);
      x2 = Math.min(img.naturalWidth, x2 + padding);
      y2 = Math.min(img.naturalHeight, y2 + padding);
      
      console.log("drawBoxes - After padding:", x1, y1, x2, y2, "padding:", padding);
      console.log("drawBoxes - Scale:", scaleX, scaleY);
      
      ctx.strokeStyle = CONFIG.ui.boxStrokeStyle;
      ctx.lineWidth   = CONFIG.ui.boxLineWidth;
      ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
    });
  }

  /* ──────────────────────── CROP ────────────────────────────────── */
  function attachCropListeners() {
    if (!cropBtn || !cropOverlay) {
      console.warn("Crop listeners: missing cropBtn or cropOverlay");
      return;
    }
    cropBtn.addEventListener("click", toggleCrop);
    
    cropOverlay.addEventListener("mousedown", function(e) {
      if (e.target.closest(".crop-box")) {
        var handle = e.target.closest(".crop-handle");
        if (handle) {
          cropResizing = [].slice.call(handle.classList).find(function(c) { return ["tl", "tr", "bl", "br"].indexOf(c) !== -1; });
        } else {
          cropDragging = true;
        }
      } else {
        var rect = cropOverlay.getBoundingClientRect();
        var overlayX = e.clientX - rect.left;
        var overlayY = e.clientY - rect.top;
        cropRect = { x: overlayX, y: overlayY, w: 0, h: 0 };
        cropResizing = "br";
      }
      cropStartX = e.clientX;
      cropStartY = e.clientY;
      e.preventDefault();
    });

    document.addEventListener("mousemove", function(e) {
      if (!cropActive) return;
      var dx = e.clientX - cropStartX;
      var dy = e.clientY - cropStartY;
      
      if (cropDragging) {
        cropRect.x += dx;
        cropRect.y += dy;
      } else if (cropResizing) {
        switch(cropResizing) {
          case "tl":
            cropRect.x += dx;
            cropRect.y += dy;
            cropRect.w -= dx;
            cropRect.h -= dy;
            break;
          case "tr":
            cropRect.y += dy;
            cropRect.w += dx;
            cropRect.h -= dy;
            break;
          case "bl":
            cropRect.x += dx;
            cropRect.w -= dx;
            cropRect.h += dy;
            break;
          case "br":
            cropRect.w += dx;
            cropRect.h += dy;
            break;
        }
      }
      cropStartX = e.clientX;
      cropStartY = e.clientY;
      applyCropBoxStyle();
    });

    document.addEventListener("mouseup", function(e) {
      cropDragging = false;
      cropResizing = null;
    });
  }
  
  function attachResultViewListeners() {
    if (!newSearchBtn || !newUploadBtn || !sortSelect) {
      console.warn("Result view listeners: missing required elements", {
        newSearchBtn: !!newSearchBtn,
        newUploadBtn: !!newUploadBtn,
        sortSelect: !!sortSelect
      });
      return;
    }
    newSearchBtn.addEventListener("click", function() {
      resultView.classList.add("dy-hidden");
      const freshPanel = getPanel();
      if (freshPanel) freshPanel.classList.remove("dy-hidden");
      const freshFileInput = getFileInput();
      const freshUrlInput = getUrlInput();
      if (freshFileInput) freshFileInput.value = "";
      if (freshUrlInput) freshUrlInput.value = "";
    });

    newUploadBtn.addEventListener("click", function() {
      const freshFileInput = getFileInput();
      if (freshFileInput) freshFileInput.click();
    });

    sortSelect.addEventListener("change", function() {
      var sortType = sortSelect.value;
      var sortBy = null;
      
      if (sortType === "price-high") {
        sortBy = { field: "price", order: "desc" };
      } else if (sortType === "price-low") {
        sortBy = { field: "price", order: "asc" };
      }
      
      if (lastImageBase64) {
        addSpinner();
        callSearchApi(lastImageBase64, buildFiltersFromSelection(), sortBy)
          .then(function(searchResponse) {
            removeSpinner();
            if (searchResponse.choices && searchResponse.choices.length > 0) {
              var choice = searchResponse.choices[0];
              var slots = choice.variations[0].payload.data.slots;
              currentSlots = slots;
            }
            renderProducts(currentSlots);
          })
          .catch(function(err) {
            removeSpinner();
            console.error("Sort error:", err);
          });
      } else {
        renderProducts(currentSlots);
      }
    });
  }

  function toggleCrop() {
    cropActive = !cropActive;
    if (cropActive) {
      cropBtn.textContent = "Apply Crop";
      cropOverlay.classList.remove("dy-hidden");
      activeIndex = null;
      dotsContainer.querySelectorAll(".dy-detection-dot-wrapper").forEach(w => w.classList.remove("active"));
      overlayCanvas.getContext("2d").clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      initCropBox();
    } else {
      cropBtn.textContent = "Crop";
      cropOverlay.classList.add("dy-hidden");
      applyCropSearch();
    }
  }

  async function applyCropSearch() {
    if (!lastImageBase64) return;
    
    selectedFilters = {}; // reset filters on crop search
    addSpinner();
    try {
      const img = resultImg;
      
      // Convert from display coordinates to natural image coordinates
      const displayX1 = cropRect.x - offsetX;
      const displayY1 = cropRect.y - offsetY;
      const displayW = cropRect.w;
      const displayH = cropRect.h;
      
      const x1 = Math.round(displayX1 / scaleX);
      const y1 = Math.round(displayY1 / scaleY);
      const x2 = Math.round((displayX1 + displayW) / scaleX);
      const y2 = Math.round((displayY1 + displayH) / scaleY);
      
      const canvas = document.createElement('canvas');
      canvas.width = x2 - x1;
      canvas.height = y2 - y1;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, x1, y1, x2 - x1, y2 - y1, 0, 0, x2 - x1, y2 - y1);
      
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      const searchResponse = await callSearchApi(croppedBase64, []);
      removeSpinner();
      
      if (searchResponse.choices && searchResponse.choices.length > 0) {
        const choice = searchResponse.choices[0];
        const { payload: { data: { slots } } } = choice.variations[0];
        currentSlots = slots;
        renderProducts(currentSlots);
      }
    } catch (err) {
      removeSpinner();
      console.error("Search error:", err);
    }
  }

  function initCropBox() {
    const img      = resultImg;
    const displayW = img.clientWidth;
    const displayH = img.clientHeight;

    cropRect = {
      x: displayW * 0.25 + offsetX,
      y: displayH * 0.25 + offsetY,
      w: displayW * 0.5,
      h: displayH * 0.5,
    };

    applyCropBoxStyle();
  }

  function applyCropBoxStyle() {
    cropBox.style.left   = cropRect.x + "px";
    cropBox.style.top    = cropRect.y + "px";
    cropBox.style.width  = cropRect.w + "px";
    cropBox.style.height = cropRect.h + "px";
  }

  /* ─────────────────────── SPINNER ──────────────────────────────── */
  function addSpinner() {
    removeSpinner();
    if (!imageWrapper) {
      console.warn("imageWrapper not initialized, skipping spinner");
      return;
    }
    const spinner = document.createElement("div");
    spinner.className = "dy-loading-spinner";
    spinner.id = CONFIG.elements.spinner;
    spinner.innerHTML = '<div class="dy-spinner"></div><span>' + CONFIG.ui.loadingMessage + '</span>';
    imageWrapper.appendChild(spinner);
  }

  function removeSpinner() {
    const s = document.getElementById(CONFIG.elements.spinner);
    if (s) s.remove();
  }
  function showError(message) {
    removeSpinner();
    console.error(message);
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = 'position: fixed;top: 20px;left: 50%;transform: translateX(-50%);background: #d32f2f;color: #fff;padding: 16px 24px;border-radius: 4px;font-size: 0.88rem;box-shadow: 0 4px 16px rgba(0,0,0,0.15);z-index: 1000;max-width: 500px;word-wrap: break-word;';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }
  /* ─────────────────────── INIT ─────────────────────────────────── */
  const variationId = '${dyVariationId}'
  
  // Get fresh overlay reference and initialize
  overlay = getOverlay();
  
  // Start overlay hidden
  if (overlay && variationId) {
    overlay.classList.add("dy-hidden");
  }

  const freshPanel = getPanel();
  if (freshPanel) freshPanel.classList.remove("dy-hidden");
  initGallery();
  attachUploadListeners();
  attachFileChangeListeners();
  
  // Show overlay
  function showOverlay() {
    const ov = getOverlay();
    if (ov) {
      ov.classList.remove("dy-hidden");
      ov.style.display = '';
      ov.style.visibility = '';
      
      // Attach close handlers after showing
      attachCloseHandlers();
    }
  }
  
  // Hide overlay
  function hideOverlay() {
    const ov = getOverlay();
    if (ov) {
      ov.classList.add("dy-hidden");
    }
  }
  
  // Attach close button and outside click listeners
  function attachCloseHandlers() {
    const closeBtn = document.querySelector(".dy-close-btn");
    if (closeBtn && !closeBtn._closeListenerAttached) {
      closeBtn._closeListenerAttached = true;
      closeBtn.addEventListener("click", hideOverlay);
    }
    
    // Attach click handler to overlay element itself
    const ov = getOverlay();
    if (ov && !ov._bgClickHandlerAttached) {
      ov._bgClickHandlerAttached = true;
      ov.addEventListener("click", function(e) {
        // Close if click is NOT on interactive content
        const panel = getPanel();
        const resultContainer = ov.querySelector(".dy-result-container");
        
        const isClickOnPanel = panel && panel.contains(e.target);
        const isClickOnResultContainer = resultContainer && resultContainer.contains(e.target);
        
        if (!isClickOnPanel && !isClickOnResultContainer) {
          hideOverlay();
        }
      });
    }
    
    // Attach Escape key handler
    if (!document._escapeKeyAttached) {
      document._escapeKeyAttached = true;
      document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
          const ov = getOverlay();
          if (ov && !ov.classList.contains("dy-hidden")) {
            hideOverlay();
          }
        }
      });
    }
  }
  
  attachCloseHandlers();
  
  // Re-attach overlay listeners after React remount
  function reattachOverlayListeners() {
    const fileInput = getFileInput();
    const browseBtn = getBrowseBtn();
    const dropzone = getDropzone();
    const urlInput = getUrlInput();
    const searchUrlBtn = getSearchUrlBtn();
    const closeBtn = document.querySelector(".dy-close-btn");
    const ov = getOverlay();
    
    if (fileInput) fileInput._changeListenerAttached = false;
    if (browseBtn) browseBtn._uploadListenerAttached = false;
    if (dropzone) dropzone._uploadListenerAttached = false;
    if (dropzone) dropzone._dragListenerAttached = false;
    if (urlInput) urlInput._keyListenerAttached = false;
    if (searchUrlBtn) searchUrlBtn._clickListenerAttached = false;
    if (closeBtn) closeBtn._closeListenerAttached = false;
    if (ov) ov._bgClickHandlerAttached = false;
    
    attachUploadListeners();
    attachFileChangeListeners();
    attachCloseHandlers();
  }
  
  // Search button click - show overlay
  function attachSearchBtnListener() {
    const searchBtns = document.querySelectorAll(".dy-image-search-btn");
    searchBtns.forEach(function(searchBtn) {
      if (!searchBtn._searchListenerAttached) {
        searchBtn._searchListenerAttached = true;
        searchBtn.addEventListener("click", function(e) {
          if (searchBtn.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            showOverlay();
            reattachOverlayListeners();
          }
        });
      }
    });
  }
  
  attachSearchBtnListener();
  
  // Re-attach search listeners when DOM changes
  const observer = new MutationObserver(function() {
    attachSearchBtnListener();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
