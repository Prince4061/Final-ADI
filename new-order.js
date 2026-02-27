document.addEventListener('DOMContentLoaded', () => {

    const supabase = window.supabaseClient;

    // --- State Management ---
    const state = {
        cart: [], // { id, name, unit, quantity, agencyId, agencyName, agencyProductId }
        agencies: [],
        currentAgencyViewing: null
    };

    const loadAgenciesFromSupabase = async () => {
        try {
            const { data: agencies, error } = await supabase
                .from('agencies')
                .select(`id, name, agency_products(id, name, unit)`);
            if (error) throw error;
            state.agencies = agencies.map(a => ({
                id: a.id,
                agencyName: a.name,
                products: a.agency_products || []
            }));

            // Re-render if modal is partially open
            if (agencySelectionModal.classList.contains('active-view')) {
                renderAgencyListModal();
            }
        } catch (err) {
            console.error("Failed to load agencies", err);
        }
    };
    loadAgenciesFromSupabase();

    // --- DOM Elements ---
    // Main View
    const orderForm = document.getElementById('orderForm');
    const shopNameInput = document.getElementById('shopName');
    const cartContainer = document.getElementById('cartContainer');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartCountDisplay = document.getElementById('cartCount');
    const placeOrderBtn = document.getElementById('placeOrderBtn');

    // Modals
    const mainOrderScreen = document.getElementById('mainOrderScreen');
    const agencySelectionModal = document.getElementById('agencySelectionModal');
    const productSelectionModal = document.getElementById('productSelectionModal');

    // Modal Containers
    const modalAgenciesContainer = document.getElementById('modalAgenciesContainer');
    const modalProductsContainer = document.getElementById('modalProductsContainer');
    const selectedAgencyTitle = document.getElementById('selectedAgencyTitle');
    const productSearch = document.getElementById('productSearch');

    // Navigation Buttons
    const openAgencyModalBtn = document.getElementById('openAgencyModalBtn');
    const closeAgencyModalBtn = document.querySelector('.close-modal[data-target="agencySelectionModal"]');
    const backToAgenciesBtn = document.getElementById('backToAgenciesBtn');
    const doneSelectingProductsBtn = document.getElementById('doneSelectingProductsBtn');

    // --- Utility: Generate a unique ID for cart items to avoid index conflicts
    const generateId = () => Math.random().toString(36).substr(2, 9);

    // --- View Navigation ---
    const showView = (viewElement) => {
        // Hide all
        mainOrderScreen.classList.remove('active-view'); mainOrderScreen.classList.add('hidden-view');
        agencySelectionModal.classList.remove('active-view'); agencySelectionModal.classList.add('hidden-view');
        productSelectionModal.classList.remove('active-view'); productSelectionModal.classList.add('hidden-view');

        // Show requested
        viewElement.classList.remove('hidden-view');
        viewElement.classList.add('active-view');
    };

    openAgencyModalBtn.addEventListener('click', () => {
        renderAgencyListModal();
        showView(agencySelectionModal);
    });

    closeAgencyModalBtn.addEventListener('click', () => {
        showView(mainOrderScreen);
    });

    backToAgenciesBtn.addEventListener('click', () => {
        showView(agencySelectionModal);
    });

    doneSelectingProductsBtn.addEventListener('click', () => {
        showView(mainOrderScreen);
        renderCart();
    });

    // --- Rendering: Agency List Modal ---
    const renderAgencyListModal = () => {
        modalAgenciesContainer.innerHTML = '';

        if (state.agencies.length === 0) {
            modalAgenciesContainer.innerHTML = `
                <div class="glass-panel" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <p>No agencies found. Please add agencies from the Manage Data screen first.</p>
                </div>
            `;
            return;
        }

        state.agencies.forEach(agency => {
            const card = document.createElement('div');
            card.className = 'glass-panel agency-card interactive-card';
            card.style.cursor = 'pointer';

            // Calculate how many items from this agency are currently in the cart
            const itemsInCart = state.cart.filter(item => item.agencyId === agency.id).length;
            const badgeHtml = itemsInCart > 0 ? `<span class="badge" style="background: var(--accent-blue); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem;">${itemsInCart} in order</span>` : '';

            card.innerHTML = `
                <div class="agency-card-header">
                    <h3>${agency.agencyName}</h3>
                    ${badgeHtml}
                </div>
                <div class="agency-card-body" style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <p class="product-summary" style="margin: 0;">${agency.products ? agency.products.length : 0} Available Products</p>
                    <i class="fa-solid fa-chevron-right" style="color: var(--text-muted);"></i>
                </div>
            `;

            card.addEventListener('click', () => {
                state.currentAgencyViewing = agency;
                renderProductListModal();
                showView(productSelectionModal);
            });

            modalAgenciesContainer.appendChild(card);
        });
    };

    // --- Rendering: Product List Modal ---
    const renderProductListModal = (searchTerm = '') => {
        if (!state.currentAgencyViewing) return;

        const agency = state.currentAgencyViewing;
        selectedAgencyTitle.textContent = agency.agencyName;
        modalProductsContainer.innerHTML = '';

        const productsToRender = agency.products ? agency.products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) : [];

        if (productsToRender.length === 0) {
            modalProductsContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1rem;">No products found.</p>`;
            return;
        }

        productsToRender.forEach(product => {
            // Check if this product is already in the cart
            const existingCartItem = state.cart.find(item => item.agencyId === agency.id && item.name === product.name);
            const initialQty = existingCartItem ? existingCartItem.quantity : 0;

            const productRow = document.createElement('div');
            productRow.className = 'glass-panel product-selection-row';
            productRow.innerHTML = `
                <div class="product-info" style="flex: 1;">
                    <h4 style="margin: 0; font-size: 1rem; color: var(--text-main);">${product.name}</h4>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${product.unit}</span>
                </div>
                
                <div class="quantity-controls" style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-secondary); padding: 0.3rem; border-radius: 50px; border: 1px solid var(--card-border);">
                    <button type="button" class="btn-qty btn-minus" style="width: 30px; height: 30px; border-radius: 50%; border: none; background: white; color: var(--accent-primary); cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-weight: bold;">-</button>
                    <input type="number" class="qty-input" value="${initialQty}" min="0" style="width: 40px; text-align: center; border: none; background: transparent; font-weight: 600; font-family: var(--font-body); pointer-events: none;" readonly>
                    <button type="button" class="btn-qty btn-plus" style="width: 30px; height: 30px; border-radius: 50%; border: none; background: var(--accent-blue); color: white; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1); font-weight: bold;">+</button>
                </div>
            `;

            // Event Listeners for + and -
            const minusBtn = productRow.querySelector('.btn-minus');
            const plusBtn = productRow.querySelector('.btn-plus');
            const qtyInput = productRow.querySelector('.qty-input');

            const updateCartData = (newQty) => {
                if (newQty > 0) {
                    // Update or Add
                    const index = state.cart.findIndex(item => item.agencyId === agency.id && item.name === product.name);
                    if (index >= 0) {
                        state.cart[index].quantity = newQty;
                    } else {
                        state.cart.push({
                            id: generateId(),
                            agencyId: agency.id,
                            agencyName: agency.agencyName,
                            agencyProductId: product.id,
                            name: product.name,
                            unit: product.unit,
                            quantity: newQty
                        });
                    }
                } else if (newQty === 0) {
                    // Remove
                    state.cart = state.cart.filter(item => !(item.agencyId === agency.id && item.name === product.name));
                }
                updateOrderButtonState();
            };

            minusBtn.addEventListener('click', () => {
                let currentVal = parseInt(qtyInput.value) || 0;
                if (currentVal > 0) {
                    currentVal--;
                    qtyInput.value = currentVal;
                    updateCartData(currentVal);
                }
            });

            plusBtn.addEventListener('click', () => {
                let currentVal = parseInt(qtyInput.value) || 0;
                currentVal++;
                qtyInput.value = currentVal;
                updateCartData(currentVal);
            });

            modalProductsContainer.appendChild(productRow);
        });
    };

    // Product search functionality
    productSearch.addEventListener('input', (e) => {
        renderProductListModal(e.target.value);
    });

    // --- Rendering: Cart / Main Order View ---
    const renderCart = () => {
        cartCountDisplay.textContent = `${state.cart.length} items`;

        if (state.cart.length === 0) {
            emptyCartMessage.style.display = 'block';
            // Remove any dynamically added cart items
            const existingItems = cartContainer.querySelectorAll('.cart-item-card');
            existingItems.forEach(item => item.remove());
        } else {
            emptyCartMessage.style.display = 'none';
            // Keep the empty message hidden, rebuild the list

            // Remove existing
            const existingItems = cartContainer.querySelectorAll('.cart-item-card');
            existingItems.forEach(item => item.remove());

            // Render items grouped by Agency or just a flat list
            // For simplicity and clarity on mobile, a flat list with agency name is good.
            state.cart.forEach(item => {
                const itemCard = document.createElement('div');
                itemCard.className = 'glass-panel cart-item-card';
                itemCard.style.padding = '1rem';
                itemCard.style.position = 'relative';

                itemCard.innerHTML = `
                    <button type="button" class="remove-cart-item" data-id="${item.id}" style="position: absolute; top: 10px; right: 10px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; padding: 5px;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <div style="margin-right: 30px;">
                        <span style="font-size: 0.7rem; color: var(--accent-blue); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">${item.agencyName}</span>
                        <h4 style="margin: 0.2rem 0; font-size: 1.1rem; color: var(--text-main);">${item.name}</h4>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                            <span style="background: var(--bg-secondary); padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; border: 1px solid var(--card-border);">
                                Qty: ${item.quantity} ${item.unit}
                            </span>
                        </div>
                    </div>
                `;

                cartContainer.appendChild(itemCard);
            });

            // Add listener to remove buttons in cart
            document.querySelectorAll('.remove-cart-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idToRemove = e.currentTarget.dataset.id;
                    state.cart = state.cart.filter(item => item.id !== idToRemove);
                    renderCart();
                    updateOrderButtonState();
                });
            });
        }
        updateOrderButtonState();
    };

    // --- Validation and Submission ---
    const updateOrderButtonState = () => {
        const isShopNameValid = shopNameInput.value.trim().length > 0;
        const isCartValid = state.cart.length > 0;

        if (isShopNameValid && isCartValid) {
            placeOrderBtn.disabled = false;
            placeOrderBtn.style.opacity = '1';
        } else {
            placeOrderBtn.disabled = true;
            placeOrderBtn.style.opacity = '0.5';
        }
    };

    shopNameInput.addEventListener('input', updateOrderButtonState);

    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (state.cart.length === 0) return;

        const shopName = shopNameInput.value.trim();

        const originalText = placeOrderBtn.innerHTML;
        placeOrderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Placing Order...';
        placeOrderBtn.disabled = true;

        try {
            // 1. Get or Create Shop
            let shopId = null;
            const { data: existingShops, error: shopSearchErr } = await supabase
                .from('shops')
                .select('id')
                .ilike('name', shopName)
                .limit(1);

            if (shopSearchErr) throw shopSearchErr;

            if (existingShops && existingShops.length > 0) {
                shopId = existingShops[0].id;
            } else {
                const { data: newShop, error: shopInsertErr } = await supabase
                    .from('shops')
                    .insert({ name: shopName })
                    .select('id')
                    .single();
                if (shopInsertErr) throw shopInsertErr;
                shopId = newShop.id;
            }

            // 2. Create Order
            const { data: newOrder, error: orderErr } = await supabase
                .from('orders')
                .insert({
                    shop_id: shopId,
                    status: 'Pending'
                })
                .select('id')
                .single();
            if (orderErr) throw orderErr;

            // 3. Create Order Items
            const itemsToInsert = state.cart.map(cartItem => ({
                order_id: newOrder.id,
                agency_product_id: cartItem.agencyProductId,
                quantity: cartItem.quantity
            }));

            const { error: itemsErr } = await supabase
                .from('order_items')
                .insert(itemsToInsert);
            if (itemsErr) throw itemsErr;

            alert('Order Placed Successfully for ' + shopName + '!');
            state.cart = [];
            window.location.href = 'index.html';

        } catch (error) {
            console.error("Order err", error);
            alert("Failed to place order. Check console.");
            placeOrderBtn.innerHTML = originalText;
            placeOrderBtn.disabled = false;
        }
    });

    // Initialize
    updateOrderButtonState();
});
