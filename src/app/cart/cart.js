angular.module('orderCloud')

    .config(CartConfig)
    .controller('CartCtrl', CartController)
    .controller('MiniCartCtrl', MiniCartController)
    .directive('ordercloudMinicart', OrderCloudMiniCartDirective)

;

function CartConfig($stateProvider) {
    $stateProvider
        .state('cart', {
            parent: 'base',
            //data: {componentName: 'Cart'},
            url: '/cart',
            templateUrl: 'cart/templates/cart.tpl.html',
            controller: 'CartCtrl',
            controllerAs: 'cart',
            resolve: {
                Order: function($rootScope, $q, $state, toastr, CurrentOrder) {
                    var dfd = $q.defer();
                    CurrentOrder.Get()
                        .then(function(order) {
                            dfd.resolve(order)
                        })
                        .catch(function() {
                            dfd.resolve(null);
                        });
                    return dfd.promise;
                },
                CurrentOrderResolve: function(Order, $state) {
                    if (!Order) {
                        $state.go('home');
                    }
                },
                LineItemsList: function($q, $state, Order, Underscore, OrderCloud, toastr, LineItemHelpers) {
                    var dfd = $q.defer();
                    OrderCloud.LineItems.List(Order.ID)
                        .then(function(data) {
                            if (!data.Items.length) {
                                toastr.error("Your order does not contain any line items.", 'Error');
                                if ($state.current.name === 'cart') {
                                    $state.go('home');
                                }
                                dfd.reject();
                            }
                            else {
                                LineItemHelpers.GetProductInfo(data.Items)
                                    .then(function() {
                                        dfd.resolve(data);
                                    });
                            }
                        })
                        .catch(function() {
                            toastr.error("Your order does not contain any line items.", 'Error');
                            dfd.reject();
                        });
                    return dfd.promise;
                }
            }
        });
}

function CartController($q, $rootScope, OrderCloud, Order, LineItemsList, LineItemHelpers) {
    var vm = this;
    vm.order = Order;
    vm.lineItems = LineItemsList;
    vm.removeItem = LineItemHelpers.RemoveItem;
    vm.updateQuantity = LineItemHelpers.UpdateQuantity;
    vm.pagingfunction = PagingFunction;

    function PagingFunction() {
        var dfd = $q.defer();
        if (vm.lineItems.Meta.Page < vm.lineItems.Meta.TotalPages) {
            OrderCloud.LineItems.List(vm.order.ID, vm.lineItems.Meta.Page + 1, vm.lineItems.Meta.PageSize)
                .then(function(data) {
                    vm.lineItems.Meta = data.Meta;
                    vm.lineItems.Items = [].concat(vm.lineItems.Items, data.Items);
                    LineItemHelpers.GetProductInfo(vm.lineItems.Items)
                        .then(function() {
                            dfd.resolve(vm.lineItems);
                        });
                });
        }
        else dfd.reject();
        return dfd.promise;
    }

    $rootScope.$on('OC:UpdateOrder', function(event, OrderID) {
        OrderCloud.Orders.Get(OrderID)
            .then(function(data) {
                vm.order = data;
            });
    });
}

function MiniCartController($q, $state, $rootScope, OrderCloud, LineItemHelpers, CurrentOrder) {
    var vm = this;
    vm.LineItems = {};
    vm.Order = null;
    vm.showLineItems = false;

    CurrentOrder.Get()
        .then(function(data) {
            vm.Order = data;
            if (data) getLineItems(data);
        });

    vm.checkForExpress = function() {
        var expressCheckout = false;
        angular.forEach($state.get(), function(state) {
            if (state.url && state.url == '/expressCheckout') {
                expressCheckout = true;
                return expressCheckout;
            }
        });
        return expressCheckout;
    };

    vm.checkForCheckout = function() {
        var checkout = false;
        angular.forEach($state.get(), function(state) {
            if (state.url && state.url == '/checkout') {
                checkout = true;
                return checkout;
            }
        });
        return checkout;
    };

    vm.goToCart = function() {
        $state.go('cart', {}, {reload: true});
    };

    function getLineItems(order) {
        var dfd = $q.defer();
        var queue = [];
        OrderCloud.LineItems.List(order.ID)
            .then(function(li) {
                vm.LineItems = li;
                if (li.Meta.TotalPages > li.Meta.Page) {
                    var page = li.Meta.Page;
                    while (page < li.Meta.TotalPages) {
                        page += 1;
                        queue.push(OrderCloud.LineItems.List(order.ID, page));
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
        return dfd.promise;
    }

    $rootScope.$on('LineItemAddedToCart', function() {
        CurrentOrder.Get()
            .then(function(order) {
                getLineItems(order);
                vm.showLineItems = true;
            });
    });


    $rootScope.$on('OC:RemoveOrder', function(){ //broadcast is in build > src > app > common > line items
        vm.Order = null;
        vm.LineItems = {};
    });
}

function OrderCloudMiniCartDirective() {
    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'cart/templates/minicart.tpl.html',
        controller: 'MiniCartCtrl',
        controllerAs: 'minicart'
    };
}
