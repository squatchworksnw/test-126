(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Components = window.FieldOps.Components || {};

  function esc(v){ return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
  function money(v){ return Number(v || 0).toLocaleString(undefined,{style:"currency",currency:"USD"}); }
  function compact(lines){ return lines.filter(Boolean); }
  function titleize(v){ return String(v || "").replaceAll("_"," ").replace(/\b\w/g, c => c.toUpperCase()); }
  function previewText(text, max = 420){
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if(!normalized) return "";
    return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
  }
  function tone(v){
    v = String(v || "").toLowerCase();
    if(v.includes("urgent") || v.includes("overdue") || v.includes("out_of_service") || v.includes("out of service")) return "danger";
    if(v.includes("high") || v.includes("waiting") || v.includes("due") || v.includes("needs")) return "warning";
    if(v.includes("complete") || v.includes("approved") || v.includes("active")) return "ok";
    return "";
  }
  function card(title, lines=[], tags=[], cls=""){
    return `<article class="card ${cls}"><h4>${esc(title)}</h4>${compact(lines).map(l=>`<p>${esc(l)}</p>`).join("")}<div class="tags">${compact(tags).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div></article>`;
  }
  function detailRow(label, value){
    return `<div class="stat"><span>${esc(label)}</span><strong>${esc(value || "Not set")}</strong></div>`;
  }
  function documentPreviewCard(file){
    const name = file.fileName || "Attached file";
    const typeLabel = file.fileType || "File";
    const lowerName = String(name).toLowerCase();
    const lowerType = String(typeLabel).toLowerCase();
    const isImage = lowerType.includes("photo") || lowerType.includes("image") || /\.(png|jpe?g|gif|webp|heic)$/i.test(lowerName);
    const isPdf = lowerType.includes("pdf") || lowerName.endsWith(".pdf");
    const preview = previewText(file.previewText);
    const openAction = file.previewUrl ? `<a class="ghost file-open-link" href="${esc(file.previewUrl)}" target="_blank" rel="noopener">Open file</a>` : "";
    const media = file.previewUrl && isImage
      ? `<figure class="file-preview-media"><img src="${esc(file.previewUrl)}" alt="${esc(name)}" loading="lazy" /></figure>`
      : file.previewUrl && isPdf
        ? `<div class="file-preview-media pdf-preview"><iframe title="${esc(name)} preview" src="${esc(file.previewUrl)}"></iframe></div>`
        : `<div class="file-preview-fallback"><strong>${esc(typeLabel)}</strong><span>${file.previewUrl ? "Preview opens in a new tab." : "Preview unavailable until the file link is ready."}</span>${openAction}</div>`;
    return `<article class="card file-card">
      <div class="file-card-header">
        <div>
          <h4>${esc(name)}</h4>
          <p>${esc(compact([typeLabel, file.createdAt ? `Uploaded ${new Date(file.createdAt).toLocaleDateString()}` : "", file.contextLabel]).join(" | "))}</p>
        </div>
        ${openAction}
      </div>
      ${media}
      ${file.notes ? `<p>${esc(file.notes)}</p>` : ""}
      ${preview ? `<details class="file-extracted-text"><summary>Extracted text</summary><p>${esc(preview)}</p></details>` : ""}
      <div class="tags">${compact([typeLabel, titleize(file.extractionStatus || ""), file.contextLabel]).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
    </article>`;
  }
  function relatedSummaryCard(label, item, lines = [], tags = []){
    if(!item) return "";
    return card(`${label}: ${item.name || item.label || item.workOrderNumber || "Linked record"}`, lines, tags, "");
  }
  function linkedButton(label, value, viewId){
    if(!value) return "";
    return `<button class="ghost" type="button" onclick="showView('${esc(viewId)}')">${esc(label)}: ${esc(value)}</button>`;
  }
  function empty(msg){ return `<div class="empty-state" data-companion="team"><p>${esc(msg)}</p></div>`; }

  Object.assign(window.FieldOps.Components, { esc, money, compact, titleize, previewText, tone, card, detailRow, documentPreviewCard, relatedSummaryCard, linkedButton, empty });
})();

