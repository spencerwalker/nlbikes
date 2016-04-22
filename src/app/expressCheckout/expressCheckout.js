angular.module('orderCloud')
    .config(ExpressCheckoutConfig)
    .controller('ExpressCheckoutCtrl', ExpressCheckoutController)
    .controller('ExpressOrderReviewCtrl', ExpressOrderReviewController)

;

function ExpressCheckoutConfig($stateProvider) {
    $stateProvider
        .state('expressCheckout', {
            parent: 'base',
            url: '/expressCheckout',
            templateUrl: 'expressCheckout/templates/expressCheckout.tpl.html',
            controller: 'ExpressCheckoutCtrl',
            controllerAs: 'expressCheckout',
            resolve: {
                CurrentUser: function(OrderCloud) {
                    return OrderCloud.Me.Get();
                },
                Order: function($q, $state, toastr, OrderCloud, CurrentOrder, CurrentUser) {
                    var dfd = $q.defer();
                    CurrentOrder.Get()
                        .then(function(order) {
                            var patchObj = {};
                            if (!order.ShippingAddressID && CurrentUser.xp && CurrentUser.xp.defaultShippingAddressID)
                                patchObj.ShippingAddressID = CurrentUser.xp.defaultShippingAddressID;
                            if (!order.BillingAddressID && CurrentUser.xp && CurrentUser.xp.defaultBillingAddressID)
                                patchObj.BillingAddressID = CurrentUser.xp.defaultBillingAddressID;
                            if (!patchObj.ShippingAddressID && !patchObj.BillingAddressID)
                                dfd.resolve(order);
                            else {
                                OrderCloud.Orders.Patch(order.ID, patchObj)
                                    .then(function() {
                                        OrderCloud.Orders.Get(order.ID)
                                            .then(function(newOrder) {
                                                dfd.resolve(newOrder);
                                            });
                                    });
                            }
                        })
                        .catch(function() {
                            toastr.error('You do not have an active open order.', 'Error');
                            if ($state.current.name.indexOf('expressCheckout') > -1) {
                                $state.go('home');
                            }
                            dfd.reject();
                        });
                    return dfd.promise;
                },
                OrderPayments: function($q, OrderCloud, CurrentUser, CurrentOrder) {
                  var dfd = $q.defer();
                    CurrentOrder.Get()
                        .then(function(order){
                           OrderCloud.Payments.List(order.ID)
                               .then(function(payments){
                                   if(!payments.Items.length && CurrentUser.xp && CurrentUser.xp.defaultCreditCardID){
                                       OrderCloud.Payments.Create(order.ID, {Type: 'CreditCard', CreditCardID: CurrentUser.xp.defaultCreditCardID})
                                           .then(function(){
                                              OrderCloud.Payments.List(order.ID)
                                                  .then(function(newPayments){
                                                      dfd.resolve(newPayments);
                                                  });
                                           });
                                   }
                                   else if (!payments.Items.length) {
                                       OrderCloud.Payments.Create(order.ID, {})
                                           .then(function(){
                                               OrderCloud.Payments.List(order.ID)
                                                   .then(function(newPayments){
                                                       dfd.resolve(newPayments);
                                                   })
                                           })
                                   }
                                   else {
                                       dfd.resolve(payments)
                                   }
                               });
                        });
                    return dfd.promise;
                },
                CreditCards: function(OrderCloud) {
                    return OrderCloud.Me.ListCreditCards();
                },
                SpendingAccounts: function(OrderCloud) {
                    return OrderCloud.SpendingAccounts.List(null, null, null, null, null, {'RedemptionCode': '!*'});
                },
                ShippingAddresses: function($q, Underscore, OrderCloud) {
                    var dfd = $q.defer();
                    OrderCloud.Me.ListAddresses()
                        .then(function(data) {
                            dfd.resolve(Underscore.where(data.Items, {Shipping:true}));
                        });
                    return dfd.promise;
                },
                BillingAddresses: function($q, Underscore, OrderCloud) {
                    var dfd = $q.defer();
                    OrderCloud.Me.ListAddresses()
                        .then(function(data) {
                            dfd.resolve(Underscore.where(data.Items, {Biling:true}));
                        });
                    return dfd.promise;
                }
            }
    })
        .state('expressOrderReview', {
            parent: 'base',
            //data: {componentName: 'Checkout'},
            url: '/order/:orderid/expressReview',
            templateUrl: 'expressCheckout/templates/expressCheckoutReview.tpl.html',
            controller: 'ExpressOrderReviewCtrl',
            controllerAs: 'expressOrderReview',
            resolve: {
                SubmittedOrder: function($q, OrderCloud, $stateParams, $state, toastr) {
                    var dfd = $q.defer();
                    OrderCloud.Orders.Get($stateParams.orderid)
                        .then(function(order){
                            if(order.Status == 'Unsubmitted') {
                                $state.go('checkout.shipping')
                                    .then(function() {
                                        toastr.error('You cannot review an Unsubmitted Order', 'Error');
                                        dfd.reject();
                                    });
                            }
                            else dfd.resolve(order);
                        });
                    return dfd.promise;
                }
            }
        })
}

function ExpressCheckoutController($state, $rootScope, toastr, OrderCloud, CurrentUser, CurrentOrder, Order, OrderPayments, CreditCards, SpendingAccounts, ShippingAddresses, BillingAddresses) {
    var vm = this;
    vm.shippingAddresses = ShippingAddresses;
    vm.billingAddresses = BillingAddresses;
    vm.currentOrder = Order;
    vm.orderPayments = OrderPayments.Items;
    vm.creditCards = CreditCards;
    vm.spendingAccounts = SpendingAccounts;
    vm.currentUser = CurrentUser;
    vm.paymentMethods = [
        {Display: 'Purchase Order', Value: 'PurchaseOrder'},
        {Display: 'Credit Card', Value: 'CreditCard'},
        {Display: 'Spending Account', Value: 'SpendingAccount'}
    ];

    OrderCloud.LineItems.List(vm.currentOrder.ID)
        .then(function(data){
           vm.currentOrder.lineItems = data.Items;
        });

    vm.saveBillAddress = function() {
        OrderCloud.Orders.Patch(vm.currentOrder.ID, {BillingAddressID: vm.currentOrder.BillingAddressID})
            .then(function(){
               $state.reload();
            });
    };

    vm.saveShipAddress = function() {
        OrderCloud.Orders.Patch(vm.currentOrder.ID, {ShippingAddressID: vm.currentOrder.ShippingAddressID})
            .then(function(){
                $state.reload();
            });
    };

    function checkPaymentType() {
        if(vm.orderPayments[0].Type == 'CreditCard' && vm.orderPayments[0].CreditCardID) {
            OrderCloud.CreditCards.Get(vm.orderPayments[0].CreditCardID)
                .then(function(cc){
                    vm.creditCardDetails = cc;
                })
        }
        if(vm.orderPayments[0].Type == 'SpendingAccount' && vm.orderPayments[0].SpendingAccountID) {
            OrderCloud.SpendingAccounts.Get(vm.orderPayments[0].SpendingAccountID)
                .then(function(sa){
                    vm.spendingAccountDetails = sa;
                })
        }
    };

    checkPaymentType();

    vm.setPaymentMethod = function(order) {
        if (!vm.orderPayments.length) {
            // When Order Payment Method is changed it will clear out all saved payment information
            OrderCloud.Payments.Create(order.ID, {Type: vm.orderPayments[0].Type})
                .then(function() {
                    $state.reload();
                });
        }
        else {
            OrderCloud.Payments.Delete(order.ID, vm.orderPayments[0].ID)
                .then(function(){
                    OrderCloud.Payments.Create(order.ID, {Type: vm.orderPayments[0].Type})
                        .then(function() {
                            $state.reload();
                        });
                })
        }
    };

    vm.setCreditCard = function(order) {
        if (vm.orderPayments[0].Type === "CreditCard") {
            OrderCloud.Payments.Patch(order.ID, vm.orderPayments[0].ID, {CreditCardID: vm.orderPayments[0].CreditCardID})
                .then(function() {
                    $state.reload();
                });
        }
    };

    vm.setSpendingAccount = function(order) {
        if (vm.orderPayments[0].Type ==='SpendingAccount') {
            OrderCloud.Payments.Patch(order.ID, vm.orderPayments[0].ID, {SpendingAccountID: vm.orderPayments[0].SpendingAccountID})
                .then(function() {
                    $state.reload();
                })
                .catch(function(err) {
                    OrderCloud.Payments.Patch(order.ID, vm.orderPayments[0].ID, {SpendingAccountID: null})
                        .then(function() {
                            $state.reload();
                            toastr.error(err.data.Errors[0].Message + ' Please choose another payment method, or another spending account.', 'Error:')
                        })
                });
        }
    };

    vm.submitOrder = function() {
        OrderCloud.Orders.Submit(vm.currentOrder.ID)
            .then(function() {
                CurrentOrder.Remove()
                    .then(function(){
                        $state.go('orderReview', {orderid: vm.currentOrder.ID});
                        $rootScope.$broadcast('OC:RemoveOrder');
                        toastr.success('Your order has been submitted', 'Success');
                    })
            })
            .catch(function() {
                toastr.error("Your order did not submit successfully.", 'Error');
            });
    }

}

function ExpressOrderReviewController(SubmittedOrder, isMultipleAddressShipping, OrderCloud, $q, LineItemHelpers, toastr) {
    var vm = this;
    vm.submittedOrder = SubmittedOrder;
    vm.isMultipleAddressShipping = isMultipleAddressShipping;

    OrderCloud.Payments.List(vm.submittedOrder.ID)
        .then(function(data){
            vm.orderPayments = data.Items;
        })
        .then(function(){
            angular.forEach(vm.orderPayments, function(payment, index){
                if(payment.Type === 'CreditCard' && payment.CreditCardID) {
                    OrderCloud.CreditCards.Get(payment.CreditCardID)
                        .then(function(cc){
                            vm.orderPayments[index].creditCardDetails = cc;
                        })
                        .catch(function(ex){
                            toastr.error(ex, 'Error');
                        })
                }
                if(payment.Type === 'SpendingAccount' && payment.SpendingAccountID) {
                    OrderCloud.SpendingAccounts.Get(payment.SpendingAccountID)
                        .then(function(sa){
                            vm.orderPayments[index].spendingAccountDetails = sa;
                        })
                        .catch(function(ex){
                            toastr.error(ex, 'Error');
                        })
                }
            });
        });


    var dfd = $q.defer();
    var queue = [];
    OrderCloud.LineItems.List(vm.submittedOrder.ID)
        .then(function(li) {
            vm.LineItems = li;
            if (li.Meta.TotalPages > li.Meta.Page) {
                var page = li.Meta.Page;
                while (page < li.Meta.TotalPages) {
                    page += 1;
                    queue.push(OrderCloud.LineItems.List(vm.submittedOrder.ID, page));
                }
            }
            $q.all(queue)
                .then(function(results) {
                    angular.forEach(results, function(result) {
                        vm.LineItems.Items = [].concat(vm.LineItems.Items, result.Items);
                        vm.LineItems.Meta = result.Meta;
                    });
                    dfd.resolve(LineItemHelpers.GetProductInfo(vm.LineItems.Items.reverse()));
                });
        });

    vm.print = function() {
        window.print();
    };

    vm.addToFavorites = function(){
        //TODO: Refactor when SDK allows us to patch null
        if(!SubmittedOrder.xp) {
            SubmittedOrder.xp ={}
        }
        SubmittedOrder.xp.favorite = true;

        OrderCloud.Orders.Update(SubmittedOrder.ID, SubmittedOrder)
            .then(function(){
                toastr.success("Your order has been added to Favorites! You can now easily find your order in 'Order History'", 'Success')
            })
            .catch(function(){
                toastr.error('There was a problem adding this order to your Favorites', 'Error');
            });
    };
    vm.removeFromFavorites = function(){
        delete SubmittedOrder.xp.favorite;
        OrderCloud.Orders.Patch(SubmittedOrder.ID, {"xp": null} );
        toastr.success("Your order has been removed from Favorites", 'Success')
    }



}