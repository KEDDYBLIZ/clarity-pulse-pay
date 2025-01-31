import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Can create payment agreement with schedule",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;
        
        const startTime = 10;
        const endTime = 100;
        const maxPayments = 5;
        
        let block = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'create-agreement', [
                types.principal(wallet_2.address),
                types.uint(1000),
                types.uint(10),
                types.uint(startTime),
                types.uint(endTime),
                types.uint(maxPayments)
            ], wallet_1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(0);
        
        let getAgreement = chain.callReadOnlyFn(
            'pulse-pay',
            'get-agreement',
            [types.uint(0)],
            wallet_1.address
        );
        
        let agreement = getAgreement.result.expectSome().expectTuple();
        assertEquals(agreement['start-time'], types.uint(startTime));
        assertEquals(agreement['end-time'], types.uint(endTime));
        assertEquals(agreement['max-payments'], types.uint(maxPayments));
    }
});

Clarinet.test({
    name: "Cannot execute payment before start time",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'create-agreement', [
                types.principal(wallet_2.address),
                types.uint(1000),
                types.uint(10),
                types.uint(20), // Start at block 20
                types.uint(100),
                types.uint(5)
            ], wallet_1.address)
        ]);
        
        chain.mineEmptyBlockUntil(15);
        
        let paymentBlock = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'execute-payment', [
                types.uint(0)
            ], wallet_1.address)
        ]);
        
        paymentBlock.receipts[0].result.expectErr().expectUint(100);
    }
});

Clarinet.test({
    name: "Cannot execute payment after max payments reached",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'create-agreement', [
                types.principal(wallet_2.address),
                types.uint(1000),
                types.uint(10),
                types.uint(0),
                types.uint(100),
                types.uint(2) // Max 2 payments
            ], wallet_1.address)
        ]);
        
        chain.mineEmptyBlockUntil(10);
        
        // First payment
        let payment1 = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'execute-payment', [
                types.uint(0)
            ], wallet_1.address)
        ]);
        payment1.receipts[0].result.expectOk().expectBool(true);
        
        chain.mineEmptyBlockUntil(20);
        
        // Second payment
        let payment2 = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'execute-payment', [
                types.uint(0)
            ], wallet_1.address)
        ]);
        payment2.receipts[0].result.expectOk().expectBool(true);
        
        chain.mineEmptyBlockUntil(30);
        
        // Third payment attempt should fail
        let payment3 = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'execute-payment', [
                types.uint(0)
            ], wallet_1.address)
        ]);
        payment3.receipts[0].result.expectErr();
    }
});

Clarinet.test({
    name: "Can update payment schedule",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'create-agreement', [
                types.principal(wallet_2.address),
                types.uint(1000),
                types.uint(10),
                types.uint(0),
                types.uint(100),
                types.uint(5)
            ], wallet_1.address)
        ]);
        
        let updateBlock = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'update-schedule', [
                types.uint(0),
                types.uint(20),
                types.uint(200),
                types.uint(10)
            ], wallet_1.address)
        ]);
        
        updateBlock.receipts[0].result.expectOk().expectBool(true);
        
        let getAgreement = chain.callReadOnlyFn(
            'pulse-pay',
            'get-agreement',
            [types.uint(0)],
            wallet_1.address
        );
        
        let agreement = getAgreement.result.expectSome().expectTuple();
        assertEquals(agreement['start-time'], types.uint(20));
        assertEquals(agreement['end-time'], types.uint(200));
        assertEquals(agreement['max-payments'], types.uint(10));
    }
});
