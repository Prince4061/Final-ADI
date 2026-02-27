document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    const dashboardBtn = document.querySelector('.top-nav .btn-glass:first-child');
    const manageDataBtn = document.querySelector('.top-nav .btn-glass:last-child');
    const newOrderBtn = document.querySelector('.btn-huge');

    // Stats and List views
    const pendingCountEl = document.getElementById('pendingCount');
    const completedCountEl = document.getElementById('completedCount');

    const showPendingBtn = document.getElementById('showPendingBtn');
    const showCompletedBtn = document.getElementById('showCompletedBtn');

    const pendingOrdersSection = document.getElementById('pendingOrdersSection');
    const completedOrdersSection = document.getElementById('completedOrdersSection');

    const pendingOrdersContainer = document.getElementById('pendingOrdersContainer');
    const completedOrdersContainer = document.getElementById('completedOrdersContainer');

    const supabase = window.supabaseClient;

    // --- Data Storage and Logic ---
    const fetchOrdersFromSupabase = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    status,
                    created_at,
                    shops ( name ),
                    order_items (
                        quantity,
                        agency_products (
                            name,
                            unit,
                            agencies ( name )
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data.map(order => {
                const agenciesMap = {};

                order.order_items.forEach(item => {
                    if (!item.agency_products) return;

                    const agencyName = item.agency_products.agencies?.name || 'Unknown Agency';
                    if (!agenciesMap[agencyName]) {
                        agenciesMap[agencyName] = {
                            agencyName: agencyName,
                            items: []
                        };
                    }
                    agenciesMap[agencyName].items.push({
                        name: item.agency_products.name,
                        unit: item.agency_products.unit,
                        quantity: item.quantity
                    });
                });

                return {
                    orderId: order.id,
                    date: order.created_at,
                    shopName: order.shops?.name || 'Unknown Shop',
                    status: order.status,
                    details: Object.values(agenciesMap)
                };
            });
        } catch (error) {
            console.error("Error fetching orders:", error);
            return [];
        }
    };

    window.markOrderComplete = async (orderId) => {
        try {
            await supabase.from('orders').update({ status: 'Completed' }).eq('id', orderId);
            renderDashboard();
        } catch (err) { console.error(err); }
    };

    window.markOrderPending = async (orderId) => {
        try {
            await supabase.from('orders').update({ status: 'Pending' }).eq('id', orderId);
            renderDashboard();
        } catch (err) { console.error(err); }
    };

    window.deleteOrder = async (orderId) => {
        if (confirm('Are you sure you want to delete this order?')) {
            try {
                // Delete items first to respect foreign keys, then the order
                await supabase.from('order_items').delete().eq('order_id', orderId);
                await supabase.from('orders').delete().eq('id', orderId);
                renderDashboard();
            } catch (err) { console.error(err); }
        }
    };

    // View Toggling logic
    let currentView = 'pending'; // 'pending' or 'completed'

    const updateViewSelection = () => {
        if (currentView === 'pending') {
            pendingOrdersSection.classList.remove('hidden-view');
            pendingOrdersSection.classList.add('active-view');
            completedOrdersSection.classList.remove('active-view');
            completedOrdersSection.classList.add('hidden-view');

            showPendingBtn.style.border = '2px solid var(--accent-blue)';
            showCompletedBtn.style.border = '1px solid var(--card-border)';
        } else {
            completedOrdersSection.classList.remove('hidden-view');
            completedOrdersSection.classList.add('active-view');
            pendingOrdersSection.classList.remove('active-view');
            pendingOrdersSection.classList.add('hidden-view');

            showCompletedBtn.style.border = '2px solid var(--accent-success)';
            showPendingBtn.style.border = '1px solid var(--card-border)';
        }
    };

    showPendingBtn.addEventListener('click', () => {
        currentView = 'pending';
        updateViewSelection();
    });

    showCompletedBtn.addEventListener('click', () => {
        currentView = 'completed';
        updateViewSelection();
    });

    // Helper: Formatter for total items across all agencies
    const getTotalItems = (detailsArray) => {
        if (!detailsArray) return 0;
        let total = 0;
        detailsArray.forEach(agencyBlock => {
            total += agencyBlock.items.length;
        });
        return total;
    };

    const generateDetailsHtml = (detailsArray) => {
        if (!detailsArray || detailsArray.length === 0) return '';
        let html = '<div class="order-details-list" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(0,0,0,0.05);">';
        detailsArray.forEach(agency => {
            html += `<div style="margin-bottom: 0.8rem;">
                <p style="font-size: 0.75rem; color: var(--accent-blue); font-weight: 700; text-transform: uppercase; margin-bottom: 0.3rem; letter-spacing: 0.5px;">${agency.agencyName}</p>
                <div style="padding-left: 0.5rem; border-left: 2px solid var(--accent-blue); opacity: 0.9;">`;
            agency.items.forEach(item => {
                html += `<div style="font-size: 0.85rem; padding: 0.2rem 0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-main); font-weight: 500;">${item.name}</span>
                    <span style="font-weight: 600; color: var(--accent-primary); background: var(--bg-secondary); padding: 2px 8px; border-radius: 5px; font-size: 0.75rem;">${item.quantity} ${item.unit}</span>
                </div>`;
            });
            html += `</div></div>`;
        });
        html += '</div>';
        return html;
    };

    window.toggleOrderDetails = (btnElement) => {
        const card = btnElement.closest('.order-card');
        const detailsList = card.querySelector('.order-details-list');
        const icon = btnElement.querySelector('i');

        if (detailsList.style.display === 'none') {
            detailsList.style.display = 'block';
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
            btnElement.innerHTML = 'Hide Details <i class="fa-solid fa-chevron-up" style="margin-left: 5px;"></i>';
        } else {
            detailsList.style.display = 'none';
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
            btnElement.innerHTML = 'View Details <i class="fa-solid fa-chevron-down" style="margin-left: 5px;"></i>';
        }
    };

    // Render Logic
    const renderDashboard = async () => {
        pendingOrdersContainer.innerHTML = `<div style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--text-muted)"></i></div>`;
        completedOrdersContainer.innerHTML = `<div style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--text-muted)"></i></div>`;

        const orders = await fetchOrdersFromSupabase();

        // Split data based on status
        const pendingOrders = orders.filter(o => o.status === 'Pending').sort((a, b) => new Date(b.date) - new Date(a.date));
        const completedOrders = orders.filter(o => o.status === 'Completed').sort((a, b) => new Date(b.date) - new Date(a.date));

        // Update counts
        pendingCountEl.textContent = pendingOrders.length;
        completedCountEl.textContent = completedOrders.length;

        // Render Pending UI
        if (pendingOrders.length === 0) {
            pendingOrdersContainer.innerHTML = `
                <div class="glass-panel" style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
                    <p>No pending orders.</p>
                </div>`;
        } else {
            pendingOrdersContainer.innerHTML = '';
            pendingOrders.forEach(order => {
                const totalProducts = getTotalItems(order.details);
                const d = new Date(order.date);
                const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const card = document.createElement('div');
                card.className = 'glass-panel order-card';
                card.innerHTML = `
                    <div class="order-header">
                        <div>
                            <h3 style="color: var(--text-main); font-size: 1.1rem;">${order.shopName}</h3>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${dateStr}</span>
                        </div>
                        <span class="badge" style="background: rgba(245, 158, 11, 0.1); color: var(--accent-warning); border: 1px solid rgba(245,158,11,0.3);">Pending</span>
                    </div>
                    <div class="order-body" style="margin: 0.8rem 0;">
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                            <strong>${totalProducts}</strong> products ordered across <strong>${order.details ? order.details.length : 0}</strong> agencies.
                        </p>
                        <button class="btn btn-secondary" onclick="toggleOrderDetails(this)" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 6px; background: transparent; border: 1px solid var(--card-border); color: var(--text-main);">
                            View Details <i class="fa-solid fa-chevron-down" style="margin-left: 5px;"></i>
                        </button>
                        ${generateDetailsHtml(order.details)}
                    </div>
                    <div class="order-footer" style="display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px dashed var(--card-border); padding-top: 0.8rem; margin-top: 0.5rem;">
                         <button onclick="deleteOrder('${order.orderId}')" class="btn btn-icon" style="background: rgba(239, 68, 68, 0.1); color: var(--accent-danger, #ef4444); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Delete Order">
                            <i class="fa-solid fa-trash"></i>
                         </button>
                         <button onclick="markOrderComplete('${order.orderId}')" class="btn btn-icon" style="background: rgba(16, 185, 129, 0.1); color: var(--accent-success); border: 1px solid rgba(16,185,129,0.3); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Mark as Complete">
                            <i class="fa-solid fa-check"></i>
                         </button>
                    </div>
                `;
                pendingOrdersContainer.appendChild(card);
            });
        }

        // Render Completed UI
        if (completedOrders.length === 0) {
            completedOrdersContainer.innerHTML = `
                <div class="glass-panel" style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
                    <p>No completed orders yet.</p>
                </div>`;
        } else {
            completedOrdersContainer.innerHTML = '';
            completedOrders.forEach(order => {
                const totalProducts = getTotalItems(order.details);
                const d = new Date(order.date);
                const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const card = document.createElement('div');
                card.className = 'glass-panel order-card';
                card.style.opacity = '0.8';
                card.innerHTML = `
                    <div class="order-header">
                        <div>
                            <h3 style="color: var(--text-main); font-size: 1.1rem; text-decoration: line-through;">${order.shopName}</h3>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${dateStr}</span>
                        </div>
                        <span class="badge" style="background: rgba(16, 185, 129, 0.1); color: var(--accent-success); border: 1px solid rgba(16,185,129,0.3);">Completed</span>
                    </div>
                    <div class="order-body" style="margin: 0.8rem 0;">
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                            <strong>${totalProducts}</strong> products ordered across <strong>${order.details ? order.details.length : 0}</strong> agencies.
                        </p>
                        <button class="btn btn-secondary" onclick="toggleOrderDetails(this)" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 6px; background: transparent; border: 1px solid var(--card-border); color: var(--text-main);">
                            View Details <i class="fa-solid fa-chevron-down" style="margin-left: 5px;"></i>
                        </button>
                        ${generateDetailsHtml(order.details)}
                    </div>
                    <div class="order-footer" style="display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px dashed var(--card-border); padding-top: 0.8rem; margin-top: 0.5rem;">
                         <button onclick="deleteOrder('${order.orderId}')" class="btn btn-icon" style="background: rgba(239, 68, 68, 0.1); color: var(--accent-danger, #ef4444); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Delete Order">
                            <i class="fa-solid fa-trash"></i>
                         </button>
                         <button onclick="markOrderPending('${order.orderId}')" class="btn btn-icon" style="background: rgba(245, 158, 11, 0.1); color: var(--accent-warning); border: 1px solid rgba(245,158,11,0.3); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Mark as Pending (Undo)">
                            <i class="fa-solid fa-rotate-left"></i>
                         </button>
                    </div>
                `;
                completedOrdersContainer.appendChild(card);
            });
        }
    };

    // --- Existing Animations ---
    // Custom pulse effect simulation on click
    newOrderBtn.addEventListener('click', () => {
        newOrderBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            newOrderBtn.style.transform = '';
        }, 150);
    });

    const cards = document.querySelectorAll('.interactive-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            const rotateX = (-y * 0.05).toFixed(2);
            const rotateY = (x * 0.05).toFixed(2);

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0deg)`;
        });
    });

    // Mount execution
    updateViewSelection();
    renderDashboard();
});
