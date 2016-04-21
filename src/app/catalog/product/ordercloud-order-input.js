angular.module('orderCloud')

    .controller('OrderInputCtrl', OrderInputController)
    .directive('ordercloudOrderInput', OrderCloudOrderInputDirective)

;

function OrderCloudOrderInputDirective() {
    return {
        restrict: 'E',
        scope: {
            product: '=',
            validationform: '='
        },
        templateUrl: 'catalog/product/templates/order-input.tpl.html',
        controller: 'OrderInputCtrl',
        controllerAs: 'orderInput'
    };
}

function OrderInputController($state, appname, $scope, $rootScope, $localForage, OrderCloud, LineItemHelpers, Underscore, CurrentOrder) {
    var vm = this,
        orderid;
    vm.currentState = $state.current.name;
    vm.price = null;
    vm.addToCart = AddToCart;

    $localForage.getItem(appname + '.CurrentOrderID').then(function(data) {
        orderid = data;
    });
    $scope.$on('$stateChangeSuccess', function(event, toState) {vm.currentState = toState.name;});

    $scope.$watch(function() {
        return vm.Quantity;
    }, function(newValue, oldValue) {
        if (newValue && newValue !== oldValue) {
            var max_quantity = 0;
            angular.forEach($scope.product.StandardPriceSchedule.PriceBreaks, function(PriceBreaks) {
                if (vm.Quantity >= PriceBreaks.Quantity && PriceBreaks.Quantity > max_quantity) {
                    max_quantity = PriceBreaks.Quantity;
                    vm.price = PriceBreaks.Price * vm.Quantity;
                }
                else return null;
            });
        }
        else if (!newValue) {
            vm.price = null;
        }
    });

    function AddToCart() {
        CurrentOrder.Get()
            .then(function(order) {
                CurrentOrder.GetLineItems(order.ID)
                    .then(function(lineItems) {
                        order.LineItems = lineItems;
                        AddLineItem(order, $scope.product);
                    });
            })
            .catch(function() {
                OrderCloud.Orders.Create({})
                    .then(function(order) {
                        CurrentOrder.Set(order.ID);
                        AddLineItem(order, $scope.product);
                    });
            });
    }

    function AddLineItem(order, product) {
        var li = {
            ProductID: product.ID,
            Quantity: vm.Quantity,
            Specs: LineItemHelpers.SpecConvert(product.Specs)
        };
        li.ShippingAddressID = isSingleShipping(order) ? getSingleShippingAddressID(order) : null;
        OrderCloud.LineItems.Create(order.ID, li).then(function(lineItem) {
            $rootScope.$broadcast('LineItemAddedToCart', order.ID, lineItem);
        });
    }

    function isSingleShipping(order) {
        return Underscore.pluck(order.LineItems, 'ShippingAddressID').length == 1;
    }

    function getSingleShippingAddressID(order) {
        return order.LineItems[0].ShippingAddressID;
    }
}
