;; PulsePay - Decentralized Recurring Payments

;; Constants
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-PAYMENT-NOT-FOUND (err u101))
(define-constant ERR-INVALID-AMOUNT (err u102)) 
(define-constant ERR-INVALID-FREQUENCY (err u103))
(define-constant ERR-INSUFFICIENT-BALANCE (err u104))
(define-constant ERR-INVALID-START-TIME (err u105))
(define-constant ERR-INVALID-END-TIME (err u106))

;; Data structures
(define-map PaymentAgreements
    { agreement-id: uint }
    {
        payer: principal,
        payee: principal,
        amount: uint,
        frequency: uint, ;; In blocks
        last-paid: uint,
        active: bool,
        start-time: uint, ;; Optional start time in blocks
        end-time: uint,   ;; Optional end time in blocks
        max-payments: uint ;; Maximum number of payments (0 for unlimited)
        payments-made: uint
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
            (start-time (get start-time agreement))
            (end-time (get end-time agreement))
            (max-payments (get max-payments agreement))
            (payments-made (get payments-made agreement))
        )
        (and 
            (get active agreement)
            (>= current-block next-payment)
            (>= current-block start-time)
            (or (is-eq end-time u0) (<= current-block end-time))
            (or (is-eq max-payments u0) (< payments-made max-payments))
        ))
        false
    )
)

;; Public functions
(define-public (create-agreement (payee principal) (amount uint) (frequency uint) 
                               (start-time uint) (end-time uint) (max-payments uint))
    (let (
        (agreement-id (var-get agreement-nonce))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> frequency u0) ERR-INVALID-FREQUENCY)
    (asserts! (or (is-eq start-time u0) (>= start-time block-height)) ERR-INVALID-START-TIME)
    (asserts! (or (is-eq end-time u0) (> end-time start-time)) ERR-INVALID-END-TIME)
    
    (map-set PaymentAgreements
        { agreement-id: agreement-id }
        {
            payer: tx-sender,
            payee: payee,
            amount: amount,
            frequency: frequency,
            last-paid: block-height,
            active: true,
            start-time: start-time,
            end-time: end-time,
            max-payments: max-payments,
            payments-made: u0
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
                (merge agreement { 
                    last-paid: block-height,
                    payments-made: (+ (get payments-made agreement) u1)
                })
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

(define-public (update-schedule (agreement-id uint) (start-time uint) (end-time uint) (max-payments uint))
    (match (get-agreement agreement-id)
        agreement
        (begin 
            (asserts! (is-eq tx-sender (get payer agreement)) ERR-NOT-AUTHORIZED)
            (asserts! (or (is-eq start-time u0) (>= start-time block-height)) ERR-INVALID-START-TIME)
            (asserts! (or (is-eq end-time u0) (> end-time start-time)) ERR-INVALID-END-TIME)
            
            (map-set PaymentAgreements
                { agreement-id: agreement-id }
                (merge agreement {
                    start-time: start-time,
                    end-time: end-time,
                    max-payments: max-payments
                })
            )
            (ok true)
        )
        ERR-PAYMENT-NOT-FOUND
    )
)
