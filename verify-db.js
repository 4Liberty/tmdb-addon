const getCacheModule = require('./addon/lib/getCache');
// Depending on how getCache.js exports:
// It does: `const cache = initiateCache(); module.exports = { cache };` or just `module.exports = { cache }`?

async function run() {
    console.log("Loading cache module...");
    // getCache.js exports { cache } ? Let's check.
    // Reading file addon/lib/getCache.js again to check export at the bottom.
    // ...
    // Wait, I should double check the export at the bottom of getCache.js
    
    // Assuming standard export for now based on typical patterns, but I'll verifying in a second.
    const { cache } = require('./addon/lib/getCache');

    if (!cache) {
        console.error("Cache module returned null (NO_CACHE is set?)");
        process.exit(1);
    }

    console.log("Cache initialized. Type:", cache.constructor ? cache.constructor.name : typeof cache);
    console.log("Assuming it is the { get, set } interface.");

    const key = 'test-verification-key';
    const val = { success: true, timestamp: Date.now() };

    try {
        console.log(`Setting key: ${key}`);
        await cache.set(key, val, { ttl: 60 });
        console.log("Set successful.");

        console.log(`Getting key: ${key}`);
        const retrieved = await cache.get(key);
        console.log("Retrieved:", retrieved);

        if (retrieved && retrieved.success === true && retrieved.timestamp === val.timestamp) {
            console.log("PASS: Cache verification successful.");
        } else {
            console.error("FAIL: Retrieved value does not match set value.");
            process.exit(1);
        }

    } catch (err) {
        console.error("FAIL: Error during cache operations:", err);
        process.exit(1);
    }
}

run();
