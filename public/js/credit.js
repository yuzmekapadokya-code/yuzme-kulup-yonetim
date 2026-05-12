// Credit System Management
let currentUserCredits = 0;

// Initialize credit system
function initCreditSystem() {
    console.log('Credit system initializing...');

    // Load user's credit balance
    loadUserCredits();

    // Setup credit-related event listeners
    setupCreditEventListeners();
}

// Load user's credit balance
async function loadUserCredits() {
    try {
        const userId = sessionStorage.getItem('user_id');
        if (!userId) return;

        // Get user's credit document
        const creditDoc = await db.collection('user_credits').doc(userId).get();

        if (creditDoc.exists) {
            currentUserCredits = creditDoc.data().balance || 0;
        } else {
            // Create initial credit document
            await db.collection('user_credits').doc(userId).set({
                balance: 0,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
            currentUserCredits = 0;
        }

        updateCreditDisplay();
        console.log(`User credits loaded: ${currentUserCredits}`);
    } catch (error) {
        console.error('Error loading user credits:', error);
    }
}

// Update credit display in UI
function updateCreditDisplay() {
    const creditElements = document.querySelectorAll('.user-credits');
    creditElements.forEach(element => {
        element.textContent = currentUserCredits.toLocaleString('tr-TR');
    });
}

// Add credit transaction
async function addCreditTransaction(userId, amount, type, description, referenceId = null) {
    try {
        const transactionData = {
            userId: userId,
            amount: amount,
            type: type, // 'earned', 'spent', 'admin_added', 'commission'
            description: description,
            referenceId: referenceId, // workout_sale_id, product_id, etc.
            timestamp: new Date().toISOString(),
            balanceAfter: currentUserCredits + amount
        };

        // Add transaction
        await db.collection('credit_transactions').add(transactionData);

        // Update user credit balance
        await db.collection('user_credits').doc(userId).update({
            balance: currentUserCredits + amount,
            lastUpdated: new Date().toISOString()
        });

        // Update local balance
        currentUserCredits += amount;
        updateCreditDisplay();

        console.log(`Credit transaction added: ${amount} credits (${type})`);
        return true;
    } catch (error) {
        console.error('Error adding credit transaction:', error);
        return false;
    }
}

// Check if user has enough credits
function hasEnoughCredits(amount) {
    return currentUserCredits >= amount;
}

// Calculate commission for workout sales
function calculateCommission(price) {
    // Get commission rate from settings (default 30%)
    const commissionRate = 0.30; // This should come from database settings
    return Math.round(price * commissionRate);
}

// Process workout purchase
async function processWorkoutPurchase(saleId) {
    try {
        const saleDoc = await db.collection('workout_sales').doc(saleId).get();
        if (!saleDoc.exists) {
            throw new Error('Sale not found');
        }

        const sale = saleDoc.data();
        const buyerId = sessionStorage.getItem('user_id');

        if (!buyerId) {
            throw new Error('User not logged in');
        }

        // Check if buyer has enough credits
        if (!hasEnoughCredits(sale.price)) {
            throw new Error('Yetersiz kredi bakiyesi');
        }

        // Calculate commission
        const commission = calculateCommission(sale.price);
        const sellerEarnings = sale.price - commission;

        // Process the transaction
        const success = await db.runTransaction(async (transaction) => {
            // Deduct from buyer
            const buyerCreditRef = db.collection('user_credits').doc(buyerId);
            const buyerDoc = await transaction.get(buyerCreditRef);

            if (!buyerDoc.exists) {
                throw new Error('Buyer credit document not found');
            }

            const buyerBalance = buyerDoc.data().balance;
            if (buyerBalance < sale.price) {
                throw new Error('Insufficient credits');
            }

            // Add to seller
            const sellerCreditRef = db.collection('user_credits').doc(sale.sellerId);
            const sellerDoc = await transaction.get(sellerCreditRef);

            let sellerBalance = 0;
            if (sellerDoc.exists) {
                sellerBalance = sellerDoc.data().balance;
            }

            // Update balances
            transaction.update(buyerCreditRef, {
                balance: buyerBalance - sale.price,
                lastUpdated: new Date().toISOString()
            });

            transaction.update(sellerCreditRef, {
                balance: sellerBalance + sellerEarnings,
                lastUpdated: new Date().toISOString()
            });

            // Mark sale as completed
            transaction.update(db.collection('workout_sales').doc(saleId), {
                status: 'completed',
                completedAt: new Date().toISOString(),
                buyerId: buyerId
            });

            // Add transaction records
            const buyerTransactionRef = db.collection('credit_transactions').doc();
            transaction.set(buyerTransactionRef, {
                userId: buyerId,
                amount: -sale.price,
                type: 'spent',
                description: `Antrenman satın alındı: ${sale.name}`,
                referenceId: saleId,
                timestamp: new Date().toISOString(),
                balanceAfter: buyerBalance - sale.price
            });

            const sellerTransactionRef = db.collection('credit_transactions').doc();
            transaction.set(sellerTransactionRef, {
                userId: sale.sellerId,
                amount: sellerEarnings,
                type: 'earned',
                description: `Antrenman satıldı: ${sale.name}`,
                referenceId: saleId,
                timestamp: new Date().toISOString(),
                balanceAfter: sellerBalance + sellerEarnings
            });

            // System commission record
            const systemTransactionRef = db.collection('credit_transactions').doc();
            transaction.set(systemTransactionRef, {
                userId: 'system',
                amount: commission,
                type: 'commission',
                description: `Komisyon: ${sale.name} satışı`,
                referenceId: saleId,
                timestamp: new Date().toISOString(),
                balanceAfter: 0 // System doesn't have balance
            });

            return true;
        });

        if (success) {
            // Update local balance
            currentUserCredits -= sale.price;
            updateCreditDisplay();

            // Share workout with buyer
            await shareWorkoutWithBuyer(saleId, buyerId);

            return { success: true, message: 'Antrenman başarıyla satın alındı!' };
        }

    } catch (error) {
        console.error('Error processing workout purchase:', error);
        return { success: false, message: error.message };
    }
}

// Share purchased workout with buyer
async function shareWorkoutWithBuyer(saleId, buyerId) {
    try {
        const saleDoc = await db.collection('workout_sales').doc(saleId).get();
        const sale = saleDoc.data();

        // Create purchased workout record
        await db.collection('purchased_workouts').add({
            buyerId: buyerId,
            workoutId: sale.workoutId,
            sellerId: sale.sellerId,
            exercises: sale.exercises,
            name: sale.name,
            description: sale.description,
            purchasedAt: new Date().toISOString(),
            originalSaleId: saleId
        });

        console.log('Workout shared with buyer successfully');
    } catch (error) {
        console.error('Error sharing workout with buyer:', error);
    }
}

// Load credit transaction history
async function loadCreditHistory(containerId, limit = 20) {
    try {
        const userId = sessionStorage.getItem('user_id');
        if (!userId) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const transactionsSnap = await db.collection('credit_transactions')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const transactions = transactionsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        if (transactions.length === 0) {
            container.innerHTML = '<p class="no-transactions">Henüz işlem geçmişi bulunmuyor.</p>';
            return;
        }

        let html = '';
        transactions.forEach(transaction => {
            const date = new Date(transaction.timestamp).toLocaleDateString('tr-TR');
            const time = new Date(transaction.timestamp).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const amountClass = transaction.amount > 0 ? 'positive' : 'negative';
            const amountPrefix = transaction.amount > 0 ? '+' : '';

            let typeIcon = '';
            switch (transaction.type) {
                case 'earned':
                    typeIcon = '💰';
                    break;
                case 'spent':
                    typeIcon = '🛒';
                    break;
                case 'admin_added':
                    typeIcon = '👑';
                    break;
                case 'commission':
                    typeIcon = '💼';
                    break;
                default:
                    typeIcon = '💳';
            }

            html += `
                <div class="transaction-item">
                    <div class="transaction-icon">${typeIcon}</div>
                    <div class="transaction-details">
                        <div class="transaction-description">${transaction.description}</div>
                        <div class="transaction-meta">${date} ${time}</div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountPrefix}${transaction.amount.toLocaleString('tr-TR')} Kredi
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading credit history:', error);
        document.getElementById(containerId).innerHTML = '<p class="error">Geçmiş yüklenirken hata oluştu.</p>';
    }
}

// Setup credit-related event listeners
function setupCreditEventListeners() {
    // This will be called when credit system is initialized
    console.log('Credit event listeners setup');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a page that needs credit system
    if (document.querySelector('.user-credits') || document.querySelector('.credit-history')) {
        initCreditSystem();
    }
});

// Export functions for global use
window.CreditSystem = {
    init: initCreditSystem,
    loadCredits: loadUserCredits,
    addTransaction: addCreditTransaction,
    hasEnoughCredits: hasEnoughCredits,
    processWorkoutPurchase: processWorkoutPurchase,
    loadHistory: loadCreditHistory,
    getBalance: () => currentUserCredits
};
