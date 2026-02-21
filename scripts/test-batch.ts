import "dotenv/config";
import axios from "axios";

const API_URL = "http://localhost:3000/api";

async function testBatchReservation() {
    console.log("🧪 Testing Batch Reservation (Atomic Multi-SKU)");

    // 1. Create two products
    const p1 = await axios.post(`${API_URL}/products`, {
        name: "Batch Product 1",
        totalStock: 5,
        price: 10
    });
    const p2 = await axios.post(`${API_URL}/products`, {
        name: "Batch Product 2",
        totalStock: 5,
        price: 20
    });

    const id1 = p1.data.data.id;
    const id2 = p2.data.data.id;

    console.log(`✅ Created Products: ${id1}, ${id2}`);

    // 2. Reserve both at once
    console.log("🚀 Attempting batch reservation...");
    try {
        const res = await axios.post(`${API_URL}/reservations/reserve`, {
            userId: "tester",
            items: [
                { productId: id1, quantity: 2 },
                { productId: id2, quantity: 3 }
            ]
        });
        console.log("✅ Batch reservation successful:", res.data.message);
    } catch (error: any) {
        console.error("❌ Batch reservation failed:", error.response?.data || error.message);
        process.exit(1)
    }

    // 3. Verify stock in Redis/DB
    const s1 = await axios.get(`${API_URL}/products/${id1}/status`);
    const s2 = await axios.get(`${API_URL}/products/${id2}/status`);

    console.log(`📊 Status P1: avail=${s1.data.data.availableStock} res=${s1.data.data.reservedStock}`);
    console.log(`📊 Status P2: avail=${s2.data.data.availableStock} res=${s2.data.data.reservedStock}`);

    if (s1.data.data.availableStock === 3 && s2.data.data.availableStock === 2) {
        console.log("✅ Stock correctly decremented.");
    } else {
        console.error("❌ Stock mismatch!");
        process.exit(1);
    }

    // 4. Test atomic failure (e.g., one item out of stock)
    console.log("🚀 Testing atomic failure (one item has insufficient stock)...");
    try {
        await axios.post(`${API_URL}/reservations/reserve`, {
            userId: "tester2",
            items: [
                { productId: id1, quantity: 1 },
                { productId: id2, quantity: 99 } // Impossible
            ]
        });
        console.error("❌ Error: Reservation should have failed!");
        process.exit(1);
    } catch (error: any) {
        console.log("✅ Correctly rejected:", error.response?.data?.message);
    }

    // 5. Verify that P1 stock was NOT decremented further (Atomicity check)
    const s1final = await axios.get(`${API_URL}/products/${id1}/status`);
    if (s1final.data.data.availableStock === 3) {
        console.log("✅ Atomicity confirmed: P1 stock remains 3.");
    } else {
        console.error("❌ Atomicity failed! P1 stock was decremented despite overall failure.");
        process.exit(1);
    }

    console.log("🏁 Batch reservation tests passed!");
}

testBatchReservation();
