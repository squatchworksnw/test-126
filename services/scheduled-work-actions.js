(function(){
  window.addEventListener?.('load', () => {
    if(!window.FieldOps?.Views) return;
    let scheduledFilter = 'upcoming';
    const LIMIT = 120;
    const todayLocal = () => typeof todayString === 'function' ? todayString() : new Date().toISOString().slice(0,10);
    const month = value => String(value || '').slice(0,7);
    const open = item => String(item?.status || '').toLowerCase() !== 'complete';
    const searchValue = () => String(document.getElementById('scheduledWorkSearchInput')?.value || '').trim().toLowerCase();
    const sourceMonth = item => {
      const notes = String(item?.notes || '');
      const source = notes.match(/Source:\s*([A-Za-z]{3,9}\s+\d{4})/i)?.[1];
      if(source) return source;
      if(item?.date) return new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { month:'short', year:'numeric' });
      return 'No source month';
    };
    const areaSystem = item => {
      const notes = String(item?.notes || '');
      return notes.match(/Area\/system:\s*([^\n]+)/i)?.[1]?.trim() ||
        notes.match(/Applies to:\s*([^\n]+)/i)?.[1]?.trim() ||
        notes.match(/Needs anchor review:\s*([^\n]+)/i)?.[1]?.trim() ||
        item?.location || 'Missing details';
    };
    const haystack = item => [
      item.workOrderNumber, item.name, item.type, item.status, item.priority, item.date, item.location, item.notes,
      app?.projects?.find(p => p.id === item.projectId)?.name,
      app?.buildings?.find(b => b.id === item.buildingId)?.name,
      app?.spaces?.find(s => s.id === item.spaceId)?.name,
      app?.assets?.find(a => a.id === item.assetId)?.name,
      app?.vehicles?.find(v => v.id === item.vehicleId)?.name,
      app?.vendors?.find(v => v.id === item.vendorBidId)?.name
    ].filter(Boolean).join(' ').toLowerCase();
    const scheduled = item => {
      const text = haystack(item);
      return text.includes('master import key:') || text.includes('scheduled from master calendar') || text.includes('recurring template') || text.includes('fleet recurring schedule item') || text.includes('walkthrough checklist item');
    };
    const linkedId = item => String(item?.notes || '').match(/Linked active work order:\s*([^\n]+)/i)?.[1]?.trim() || '';
    const matches = item => {
      const query = searchValue();
      if(query) return haystack(item).includes(query);
      const today = todayLocal();
      if(scheduledFilter === 'today') return open(item) && item.date === today;
      if(scheduledFilter === 'overdue') return open(item) && item.date && item.date < today;
      if(scheduledFilter === 'month') return open(item) && month(item.date) === month(today);
      if(scheduledFilter === 'fleet') return open(item) && (haystack(item).includes('fleet') || haystack(item).includes('vehicle') || Boolean(item.vehicleId));
      if(scheduledFilter === 'walkthrough') return open(item) && haystack(item).includes('walkthrough');
      if(scheduledFilter === 'completed') return String(item.status || '').toLowerCase() === 'complete';
      if(scheduledFilter === 'all') return true;
      return open(item) && (!item.date || item.date >= today);
    };
    const filtered = () => (typeof activeItems === 'function' ? activeItems('tasks') : [])
      .filter(scheduled).filter(matches)
      .sort((a,b) => String(a.date || '9999-99-99').localeCompare(String(b.date || '9999-99-99')) || String(a.name || '').localeCompare(String(b.name || '')));
    const syncButtons = () => {
      const searching = Boolean(searchValue());
      document.querySelectorAll('[data-scheduled-filter]').forEach(button => {
        const active = button.dataset.scheduledFilter === scheduledFilter && !searching;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };
    const row = item => {
      const complete = String(item.status || '').toLowerCase() === 'complete';
      const link = linkedId(item);
      const linkText = link ? (app?.tasks?.find(t => t.id === link)?.workOrderNumber || 'Linked work order created') : '';
      return `<article class="scheduled-work-row">
        <div class="scheduled-date">${esc(item.date || 'No date')}</div>
        <div><strong>${esc(item.name || 'Scheduled work')}</strong><p class="meta">${esc(areaSystem(item))}</p>${linkText ? `<p class="meta"><strong>${esc(linkText)}</strong></p>` : ''}</div>
        <div class="scheduled-source">${esc(sourceMonth(item))}</div>
        <div><span class="status-chip ${tone(item.status)}">${esc(titleize(item.status || 'open'))}</span></div>
        <div class="actions no-print scheduled-actions">
          <button type="button" onclick="openWorkOrderDetail('${item.id}')">Open</button>
          ${complete ? '' : `<button class="ghost" type="button" onclick="markWorkOrderComplete('${item.id}')">Complete</button>`}
          ${complete ? '' : `<button class="ghost" type="button" onclick="createWorkOrderFromScheduledTask('${item.id}')">${link ? 'Open Linked Work' : 'Create Work Order'}</button>`}
          ${complete ? '' : `<button class="ghost" type="button" onclick="createSupplyRequestFromScheduledTask('${item.id}')">Supply Request</button>`}
          <button class="ghost" type="button" onclick="attachFileFromScheduledTask('${item.id}')">Attach File</button>
          <button class="ghost" type="button" onclick="addNoteFromScheduledTask('${item.id}')">Add Note</button>
        </div>
      </article>`;
    };
    function renderScheduledWork(){
      const list = document.getElementById('scheduledWorkList');
      if(!list) return;
      syncButtons();
      const items = filtered();
      const shown = items.slice(0, LIMIT);
      list.innerHTML = shown.length ? shown.map(row).join('') + (items.length > shown.length ? empty(`Showing the first ${shown.length} of ${items.length}. Search or choose a tighter filter to narrow this down.`) : '') : empty(searchValue() ? 'No scheduled work matches that search.' : 'No scheduled work in this view.');
      const status = document.getElementById('scheduledWorkStatus');
      if(status){
        const label = searchValue() ? `search for "${searchValue()}"` : scheduledFilter.replace(/_/g, ' ');
        status.textContent = `Showing ${shown.length} of ${items.length} for ${label}.`;
      }
    }
    async function createWorkOrderFromScheduledTask(taskId){
      if(typeof requireOperationsPermission === 'function' && !requireOperationsPermission('create work order from scheduled work')) return;
      const task = app?.tasks?.find(item => item.id === taskId);
      if(!task) return;
      const existing = linkedId(task);
      if(existing){
        if(app?.tasks?.some(item => item.id === existing)) openWorkOrderDetail(existing);
        else setStatus?.('Linked work order exists but is not loaded yet.');
        return;
      }
      try{
        setStatus?.('Creating linked work order...');
        const payload = {
          id: typeof id === 'function' ? id() : crypto.randomUUID(),
          title: task.name || 'Scheduled work follow-up',
          type: task.type || 'maintenance',
          status: 'open',
          priority: task.priority || 'normal',
          due_date: task.date || null,
          project_id: task.projectId || null,
          building_id: task.buildingId || null,
          space_id: task.spaceId || null,
          asset_id: task.assetId || null,
          vehicle_id: task.vehicleId || null,
          vendor_id: task.vendorBidId || null,
          description: task.location || areaSystem(task) || null,
          notes: [`Created from scheduled work: ${task.name || task.id}`, `Original scheduled record: ${task.id}`, `Scheduled source: ${sourceMonth(task)}`].join('\n')
        };
        const saved = await insertRecord('field_ops_work_orders', payload);
        const newId = saved?.id || payload.id;
        await updateRecord('field_ops_work_orders', task.id, { notes: appendHistory(task.notes, `Linked active work order: ${newId}`) });
        setStatus?.('Linked work order created');
        setTimeout(() => openWorkOrderDetail(newId), 300);
      }catch(err){ console.error(err); setStatus?.(`Could not create linked work order: ${err.message}`); }
    }
    function createSupplyRequestFromScheduledTask(taskId){
      const task = app?.tasks?.find(item => item.id === taskId);
      if(!task) return;
      showView?.('materials');
      setTimeout(() => {
        if(typeof renderMaterials === 'function') renderMaterials();
        const workOrderId = linkedId(task) || task.id;
        if(document.getElementById('materialTitle')) materialTitle.value = `${task.name || 'Scheduled work'} supplies`;
        if(document.getElementById('materialWorkOrder')) materialWorkOrder.value = workOrderId;
        if(document.getElementById('materialLines')) materialLines.value = 'Item needed | 1 | each | 0.00';
        if(document.getElementById('materialNotes')) materialNotes.value = [`Requested from scheduled work: ${task.name || task.id}`, `Scheduled source: ${sourceMonth(task)}`, `Area/system: ${areaSystem(task)}`].join('\n');
        document.getElementById('materialTitle')?.focus();
        setStatus?.('Supply request started from scheduled work');
      }, 150);
    }
    function attachFileFromScheduledTask(taskId){ openWorkOrderDetail?.(taskId); setTimeout(() => focusWorkOrderField?.('workOrderDetailUpload'), 200); }
    function addNoteFromScheduledTask(taskId){ openWorkOrderDetail?.(taskId); setTimeout(() => focusWorkOrderField?.('workOrderDetailNote'), 200); }
    function setScheduledWorkFilter(filter){
      scheduledFilter = filter || 'upcoming';
      const search = document.getElementById('scheduledWorkSearchInput');
      if(search) search.value = '';
      renderScheduledWork();
    }
    Object.assign(globalThis, { renderScheduledWork, setScheduledWorkFilter, createWorkOrderFromScheduledTask, createSupplyRequestFromScheduledTask, attachFileFromScheduledTask, addNoteFromScheduledTask });
    window.FieldOps.Views.renderScheduledWork = renderScheduledWork;
    renderScheduledWork();
  });
})();
