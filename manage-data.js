document.addEventListener('DOMContentLoaded', () => {
    // --- View Management ---
    const listView = document.getElementById('agencyListView');
    const formView = document.getElementById('addAgencyView');
    const showAddFormBtn = document.getElementById('showAddFormBtn');
    const cancelAddBtn = document.getElementById('cancelAddBtn');
    const savedAgenciesContainer = document.getElementById('savedAgenciesContainer');

    // Header title to change based on context
    const formTitle = formView.querySelector('.section-title');

    let currentEditId = null; // Track if we are editing

    function toggleViews(showForm, isEdit = false) {
        if (showForm) {
            listView.classList.remove('active-view');
            listView.classList.add('hidden-view');
            formView.classList.remove('hidden-view');
            formView.classList.add('active-view');

            formTitle.textContent = isEdit ? 'Edit Agency' : 'Add New Agency';
        } else {
            formView.classList.remove('active-view');
            formView.classList.add('hidden-view');
            listView.classList.remove('hidden-view');
            listView.classList.add('active-view');
            currentEditId = null; // Reset edit state
        }
    }

    showAddFormBtn.addEventListener('click', () => {
        agencyForm.reset();
        productsContainer.innerHTML = '';
        productIndex = 0;
        addNewProductRow();
        toggleViews(true, false);
    });

    cancelAddBtn.addEventListener('click', () => toggleViews(false));

    // --- Dynamic Form Logic ---
    const productsContainer = document.getElementById('productsContainer');
    const addProductBtn = document.getElementById('addProductBtn');
    const agencyForm = document.getElementById('agencyForm');
    const productCountDisplay = document.getElementById('productCount');

    let productIndex = 1;

    const updateProductCount = () => {
        const count = productsContainer.querySelectorAll('.product-row').length;
        productCountDisplay.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;

        const rows = productsContainer.querySelectorAll('.product-row');
        if (rows.length === 1) {
            rows[0].querySelector('.btn-remove').style.visibility = 'hidden';
        } else {
            rows.forEach(row => {
                row.querySelector('.btn-remove').style.visibility = 'visible';
            });
        }
    };

    const addNewProductRow = (focus = false, initialName = '', initialUnit = '') => {
        const newRow = document.createElement('div');
        newRow.className = 'product-row adding-animation';
        newRow.dataset.index = productIndex;

        newRow.innerHTML = `
            <div class="input-group">
                <input type="text" class="product-name" placeholder="Product Name (e.g. Butter)" value="${initialName}" required>
            </div>
            <div class="input-group unit-group">
                <input type="text" class="product-unit" placeholder="Unit (e.g. Kg)" value="${initialUnit}" required>
            </div>
            <button type="button" class="btn btn-icon btn-remove remove-product">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        productsContainer.appendChild(newRow);

        setTimeout(() => {
            newRow.classList.remove('adding-animation');
        }, 300);

        productIndex++;
        updateProductCount();

        if (focus) {
            newRow.querySelector('.product-name').focus();
        }
    };

    addProductBtn.addEventListener('click', () => addNewProductRow(true));

    productsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-product')) {
            const row = e.target.closest('.product-row');
            if (productsContainer.querySelectorAll('.product-row').length > 1) {
                row.style.opacity = '0';
                row.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    row.remove();
                    updateProductCount();
                }, 300);
            }
        }
    });

    // --- Data Storage and Rendering (Local Storage for Frontend Demo) ---

    const supabase = window.supabaseClient;

    // Fetch from Supabase
    const getSavedAgencies = async () => {
        try {
            const { data: agencies, error } = await supabase
                .from('agencies')
                .select(`
                    id,
                    name,
                    contact_person,
                    agency_products (
                        id,
                        name,
                        unit
                    )
                `);

            if (error) throw error;
            return agencies.map(a => ({
                id: a.id,
                agencyName: a.name,
                contactNumber: a.contact_person,
                products: a.agency_products || []
            }));
        } catch (error) {
            console.error("Error fetching agencies:", error);
            return [];
        }
    };

    // Save to Supabase (handles both Add and Update)
    const saveAgencyToSupabase = async (agencyData) => {
        try {
            let agencyId = currentEditId;

            if (agencyId) {
                const { error: updateErr } = await supabase
                    .from('agencies')
                    .update({
                        name: agencyData.agencyName,
                        contact_person: agencyData.contactNumber
                    })
                    .eq('id', agencyId);
                if (updateErr) throw updateErr;
            } else {
                const { data: newAgency, error: insertErr } = await supabase
                    .from('agencies')
                    .insert({
                        name: agencyData.agencyName,
                        contact_person: agencyData.contactNumber
                    })
                    .select('id')
                    .single();
                if (insertErr) throw insertErr;
                agencyId = newAgency.id;
            }

            if (currentEditId) {
                const { error: delErr } = await supabase
                    .from('agency_products')
                    .delete()
                    .eq('agency_id', agencyId);
                if (delErr) throw delErr;
            }

            if (agencyData.products.length > 0) {
                const productsToInsert = agencyData.products.map(p => ({
                    agency_id: agencyId,
                    name: p.name,
                    unit: p.unit
                }));
                const { error: prodErr } = await supabase
                    .from('agency_products')
                    .insert(productsToInsert);
                if (prodErr) throw prodErr;
            }
            return true;
        } catch (error) {
            console.error("Error saving agency:", error);
            alert("Failed to save agency.");
            return false;
        }
    };

    // Edit an existing agency
    window.editAgency = async (id) => {
        const agencies = await getSavedAgencies();
        const agency = agencies.find(a => a.id === id);

        if (agency) {
            currentEditId = id;

            // Populate basic fields
            document.getElementById('agencyName').value = agency.agencyName;
            document.getElementById('contactNumber').value = agency.contactNumber;

            // Populate products
            productsContainer.innerHTML = '';
            productIndex = 0;

            if (agency.products && agency.products.length > 0) {
                agency.products.forEach(prod => {
                    addNewProductRow(false, prod.name, prod.unit);
                });
            } else {
                addNewProductRow(false); // At least one empty row
            }

            // Switch view
            toggleViews(true, true);
        }
    };

    // Delete an existing agency
    window.deleteAgency = async (id, name) => {
        if (!confirm(`Are you sure you want to delete agency "${name}"? This will also delete all its associated products.`)) {
            return;
        }

        try {
            // Delete associated products first (Supabase may handle this if CASCADE is set, but this is safer)
            const { error: prodErr } = await supabase
                .from('agency_products')
                .delete()
                .eq('agency_id', id);

            if (prodErr) throw prodErr;

            // Delete agency
            const { error: delErr } = await supabase
                .from('agencies')
                .delete()
                .eq('id', id);

            if (delErr) {
                if (delErr.code === '23503') {
                    throw new Error("Cannot delete agency because there are items from this agency in existing orders.");
                }
                throw delErr;
            }

            alert(`Agency "${name}" deleted successfully.`);
            await renderAgencies();
        } catch (error) {
            console.error("Error deleting agency:", error);
            alert(error.message || "Failed to delete agency.");
        }
    };

    // Render list
    const renderAgencies = async () => {
        savedAgenciesContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem;"></i>
                <p>Loading agencies...</p>
            </div>`;

        const agencies = await getSavedAgencies();

        if (agencies.length === 0) {
            savedAgenciesContainer.innerHTML = `
                <div class="glass-panel" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
                    <i class="fa-solid fa-box-open" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No agencies added yet.</p>
                </div>`;
            return;
        }

        savedAgenciesContainer.innerHTML = '';

        agencies.forEach(agency => {
            const card = document.createElement('div');
            // Adding event listener to handle click on card or delete button
            card.className = 'glass-panel agency-card interactive-card';
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-agency-btn')) {
                    e.stopPropagation();
                    deleteAgency(agency.id, agency.agencyName);
                } else {
                    editAgency(agency.id);
                }
            });

            card.innerHTML = `
                <div class="agency-card-header">
                    <h3>${agency.agencyName}</h3>
                    <div>
                        <span class="contact-badge"><i class="fa-solid fa-phone"></i> ${agency.contactNumber}</span>
                        <button type="button" class="btn btn-icon btn-remove delete-agency-btn" title="Delete Agency" style="margin-left: 0.5rem; color: var(--accent-red); padding: 0.2rem; background: transparent; border: none; cursor: pointer; font-size: 1rem;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="agency-card-body" style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <p class="product-summary" style="margin: 0; width: 85%;">
                        <strong>${agency.products ? agency.products.length : 0}</strong> Products: 
                        ${agency.products ? agency.products.map(p => p.name).join(', ') : ''}
                    </p>
                    <i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>
                </div>
            `;

            savedAgenciesContainer.appendChild(card);
        });
    };

    // Form Submission
    agencyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const agencyName = document.getElementById('agencyName').value.trim();
        const contactNumber = document.getElementById('contactNumber').value.trim();

        const products = [];
        const productRows = productsContainer.querySelectorAll('.product-row');

        productRows.forEach(row => {
            const name = row.querySelector('.product-name').value.trim();
            const unit = row.querySelector('.product-unit').value.trim();
            if (name && unit) {
                products.push({ name, unit });
            }
        });

        const payload = {
            agencyName,
            contactNumber,
            products
        };

        // UI Effects
        const submitBtn = agencyForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        submitBtn.disabled = true;

        const success = await saveAgencyToSupabase(payload);

        if (success) {
            // Reset form
            agencyForm.reset();
            productsContainer.innerHTML = '';
            productIndex = 0;
            addNewProductRow(false);

            // Re-render list and switch view back
            await renderAgencies();
            toggleViews(false);
        }

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });

    // Initial Render
    renderAgencies();
});
