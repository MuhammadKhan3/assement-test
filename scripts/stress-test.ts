#!/usr/bin/env ts-node
/**
 * Concurrency Stress Test
 * ========================
 * Creates a product with 5 units, then fires 50 concurrent reservation
 * requests for 1 unit each. Asserts that exactly 5 succeed and 45 fail.
 *
 * Usage: npx ts-node scripts/stress-test.ts
 * (Make sure the API server is running first: npm run dev)
 */

import "dotenv/config";

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const PRODUCT_STOCK = 5;
const CONCURRENT_USERS = 50;

interface ApiResponse {
    success: boolean;
    message?: string;
}

async function createProduct(): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Stress Test Product",
            description: "Limited edition for concurrency test",
            totalStock: PRODUCT_STOCK,
            price: 99.99,
        }),
    });

    if (!res.ok) {
        const body = await res.json() as ApiResponse;
        throw new Error(`Failed to create product: ${body.message}`);
    }

    const data = await res.json() as { data: { id: string } };
    console.log(`✅ Created product ID: ${data.data.id} with ${PRODUCT_STOCK} units`);
    return data.data.id;
}

async function reserveOneUnit(userId: string, productId: string): Promise<{ userId: string; success: boolean; status: number }> {
    const res = await fetch(`${BASE_URL}/api/reservations/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId,
            items: [{ productId, quantity: 1 }],
        }),
    });

    const body = await res.json() as ApiResponse;
    return { userId, success: res.ok, status: res.status };
}

async function getStatus(productId: string): Promise<{ totalStock: number; reservedStock: number; availableStock: number }> {
    const res = await fetch(`${BASE_URL}/api/products/${productId}/status`);
    const data = await res.json() as { data: { totalStock: number; reservedStock: number; availableStock: number } };
    return data.data;
}

async function run() {
    console.log("⚡ Flash Deal Concurrency Stress Test");
    console.log("=====================================");
    console.log(`📦 Product stock: ${PRODUCT_STOCK}`);
    console.log(`👥 Concurrent users: ${CONCURRENT_USERS}`);
    console.log("");

    // 1. Create a product
    const productId = await createProduct();

    // 2. Fire all requests concurrently
    console.log(`\n🚀 Firing ${CONCURRENT_USERS} concurrent reserve requests...\n`);

    const requests = Array.from({ length: CONCURRENT_USERS }, (_, i) =>
        reserveOneUnit(`stress-user-${i + 1}`, productId)
    );

    const results = await Promise.all(requests);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    console.log(`✅ Successful reservations: ${successes.length}`);
    console.log(`❌ Failed reservations:     ${failures.length}`);

    // 3. Check stock status
    const status = await getStatus(productId);
    console.log(`\n📊 Product Status:`);
    console.log(`   totalStock:     ${status.totalStock}`);
    console.log(`   reservedStock:  ${status.reservedStock}`);
    console.log(`   availableStock: ${status.availableStock}`);

    // 4. Assert correctness
    console.log("\n🔍 Assertions:");

    const successCount = successes.length;
    const expectedSuccesses = PRODUCT_STOCK;

    if (successCount === expectedSuccesses) {
        console.log(`   ✅ PASS: Exactly ${expectedSuccesses} reservations succeeded (no overselling!)`);
    } else {
        console.log(`   ❌ FAIL: Expected ${expectedSuccesses} successes, got ${successCount}`);
    }

    if (status.availableStock === 0) {
        console.log(`   ✅ PASS: Available stock is 0`);
    } else {
        console.log(`   ❌ FAIL: Available stock should be 0, got ${status.availableStock}`);
    }

    if (status.reservedStock === PRODUCT_STOCK) {
        console.log(`   ✅ PASS: Reserved stock equals initial stock (${PRODUCT_STOCK})`);
    } else {
        console.log(`   ❌ FAIL: Reserved stock expected ${PRODUCT_STOCK}, got ${status.reservedStock}`);
    }

    console.log("\n🏁 Stress test complete.");
    process.exit(0);
}

run().catch((err: Error) => {
    console.error("Stress test error:", err.message);
    process.exit(1);
});
