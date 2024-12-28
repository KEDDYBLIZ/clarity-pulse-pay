;; PulsePay - Decentralized Recurring Payments

;; Constants
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-PAYMENT-NOT-FOUND (err u101))
(define-constant ERR-INVALID-AMOUNT (err u102))
(define-constant ERR-INVALID-FREQUENCY (err u103))
(define-constant ERR-INSUFFICIENT-BALANCE (err u104))

;; Data structures
(define-map PaymentAgreements
    { agreement-id: uint }
    {
        payer: principal,
        payee: principal,
        amount: uint,
        frequency: uint, ;; In blocks
        last-paid: uint,
        active: bool
    }
)

(define-data-var agreement-nonce uint u0)

;; Read-only functions
(define-read-only (get-agreement (agreement-id uint))
    (map-get? PaymentAgreements { agreement-id: agreement-id })
)

(define-read-only (is-payment-due (agreement-id uint))
    (match (get-agreement agreement-id)
        agreement (let (
            (current-block block-height)
            (next-payment (+ (get last-paid agreement) (get frequency agreement)))
        )
        (and (get active agreement) (>= current-block next-payment)))
        false
    )
)

;; Public functions
(define-public (create-agreement (payee principal) (amount uint) (frequency uint))
    (let (
        (agreement-id (var-get agreement-nonce))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> frequency u0) ERR-INVALID-FREQUENCY)
    
    (map-set PaymentAgreements
        { agreement-id: agreement-id }
        {
            payer: tx-sender,
            payee: payee,
            amount: amount,
            frequency: frequency,
            last-paid: block-height,
            active: true
        }
    )
    
    (var-set agreement-nonce (+ agreement-id u1))
    (ok agreement-id))
)

(define-public (execute-payment (agreement-id uint))
    (match (get-agreement agreement-id)
        agreement 
        (begin
            (asserts! (get active agreement) ERR-PAYMENT-NOT-FOUND)
            (asserts! (is-payment-due agreement-id) ERR-NOT-AUTHORIZED)
            
            (try! (stx-transfer? 
                (get amount agreement)
                (get payer agreement)
                (get payee agreement)
            ))
            
            (map-set PaymentAgreements
                { agreement-id: agreement-id }
                (merge agreement { last-paid: block-height })
            )
            (ok true)
        )
        ERR-PAYMENT-NOT-FOUND
    )
)

(define-public (cancel-agreement (agreement-id uint))
    (match (get-agreement agreement-id)
        agreement 
        (begin
            (asserts! (is-eq tx-sender (get payer agreement)) ERR-NOT-AUTHORIZED)
            (map-set PaymentAgreements
                { agreement-id: agreement-id }
                (merge agreement { active: false })
            )
            (ok true)
        )
        ERR-PAYMENT-NOT-FOUND
    )
)