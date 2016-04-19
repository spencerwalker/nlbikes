angular.module('orderCloud')
	.config(checkoutPaymentConfig)
	.controller('CheckoutPaymentCtrl', CheckoutPaymentController)
;

function checkoutPaymentConfig($stateProvider) {
	$stateProvider
		.state('checkout.payment', {
			url: '/payment',
			templateUrl: 'checkout/payment/templates/checkout.payment.tpl.html',
			controller: 'CheckoutPaymentCtrl',
			controllerAs: 'checkoutPayment',
			resolve: {
                AvailableCreditCards: function(OrderCloud) {
                    return OrderCloud.Me.ListCreditCards();
                },
                AvailableSpendingAccounts: function(OrderCloud) {
                    // TODO: Needs to be refactored to work with Me Service
                    return OrderCloud.SpendingAccounts.List(null, null, null, null, null, {'RedemptionCode': '!*'});
                }
			}
		});
}

function CheckoutPaymentController($state, AvailableCreditCards, AvailableSpendingAccounts, OrderCloud, toastr, OrderPayments) {
	var vm = this;
    vm.currentOrderPayments = OrderPayments.Items;
    vm.paymentMethods = [
        {Display: 'Purchase Order', Value: 'PurchaseOrder'},
        {Display: 'Credit Card', Value: 'CreditCard'},
        {Display: 'Spending Account', Value: 'SpendingAccount'}//,
        //{Display: 'Pay Pal Express Checkout', Value: 'PayPalExpressCheckout'}
    ];
    vm.CreditCardTypes = [
        'MasterCard',
        'American Express',
        'Discover',
        'Visa'
    ];
    vm.creditCard = null;
    vm.today = new Date();
    vm.creditCards = AvailableCreditCards.Items;
    vm.spendingAccounts = AvailableSpendingAccounts.Items;
    vm.setCreditCard = SetCreditCard;
    vm.saveCreditCard = SaveCreditCard;
    vm.setSpendingAccount = SetSpendingAccount;
    vm.setPaymentMethod = SetPaymentMethod;

    function SetPaymentMethod(order) {
        if (!vm.currentOrderPayments[0].Amount) {
            // When Order Payment Method is changed it will clear out all saved payment information
            OrderCloud.Payments.Create(order.ID, {Type: vm.currentOrderPayments[0].Type})
                .then(function() {
                    $state.reload();
                });
        }
        else {
            OrderCloud.Payments.Delete(order.ID, vm.currentOrderPayments[0].ID)
                .then(function(){
                    OrderCloud.Payments.Create(order.ID, {Type: vm.currentOrderPayments[0].Type})
                        .then(function() {
                            $state.reload();
                        });
                })
        }
    }

    function SaveCreditCard(order) {
        // TODO: Needs to save the credit card with integration plug in
        if (vm.creditCard) {
            // This is just until Nick gives me the integration
            vm.Token = 'cc';
            if (vm.creditCard.PartialAccountNumber.length === 16) {
                vm.creditCard.PartialAccountNumber = vm.creditCard.PartialAccountNumber.substr(vm.creditCard.PartialAccountNumber.length - 4);
                OrderCloud.CreditCards.Create(vm.creditCard)
                    .then(function(CreditCard) {
                        OrderCloud.Me.Get()
                            .then(function(me) {
                                OrderCloud.CreditCards.SaveAssignment({
                                        CreditCardID: CreditCard.ID,
                                        UserID: me.ID
                                    })
                                    .then(function() {
                                        OrderCloud.Payments.Patch(order.ID, vm.currentOrderPayments[0].ID, {CreditCardID: CreditCard.ID})
                                            .then(function() {
                                                $state.reload();
                                            });
                                    });
                            });
                    });
            }
            else {
                toastr.error('Invalid credit card number.', 'Error:');
            }
        }
    }

    function SetCreditCard(order) {
        if (vm.currentOrderPayments[0].CreditCardID && vm.currentOrderPayments[0].Type === "CreditCard") {
            OrderCloud.Payments.Patch(order.ID, vm.currentOrderPayments[0].ID, {CreditCardID: vm.currentOrderPayments[0].CreditCardID})
                .then(function() {
                    $state.reload();
                });
        }
    }

    function SetSpendingAccount(order) {
        if (vm.currentOrderPayments[0].SpendingAccountID && vm.currentOrderPayments[0].Type ==='SpendingAccount') {
            OrderCloud.Payments.Patch(order.ID, vm.currentOrderPayments[0].ID, {SpendingAccountID: vm.currentOrderPayments[0].SpendingAccountID})
                .then(function() {
                    $state.reload();
                })
                .catch(function(err) {
                    OrderCloud.Payments.Delete(order.ID, vm.currentOrderPayments[0].ID)
                        .then(function() {
                            $state.reload();
                            toastr.error(err.data.Errors[0].Message + ' Please choose another payment method, or another spending account.', 'Error:')
                        })
                });
        }
    }
}