angular.module('orderCloud')

    .config(ProductConfig)
    .directive('ocSpecForm', OCSpecForm)
    .directive('specSelectField', SpecSelectionDirective)
    .directive('ocAddToOrder', OCAddToOrder)
    .controller('ProductCtrl', ProductController)
    .controller('LineItemEditCtrl', LineItemEditController)
    .controller('OrderInputCtrl', OrderInputController)


;

function ProductConfig($stateProvider) {
    $stateProvider
        .state('catalog.product', {
            url: '/product/:productid',
            templateUrl: 'catalog/product/templates/product.tpl.html',
            views: {
                '': {
                    templateUrl: 'catalog/product/templates/product.tpl.html',
                    controller: 'ProductCtrl',
                    controllerAs: 'product'
                }
            },
            resolve: {
                Product: function($stateParams, OrderCloud) {
                    return OrderCloud.Me.GetProduct($stateParams.productid);
                },
                SpecList: function(OrderCloud, $q, $stateParams) {
                    var queue = [];
                    var dfd = $q.defer();
                    OrderCloud.Specs.ListProductAssignments(null, $stateParams.productid)
                        .then(function(data) {
                            angular.forEach(data.Items, function(assignment) {
                                queue.push(OrderCloud.Specs.Get(assignment.SpecID));
                            });
                            $q.all(queue)
                                .then(function(result) {
                                    angular.forEach(result, function(spec) {
                                        spec.Value = spec.DefaultValue;
                                        spec.OptionID = spec.DefaultOptionID;
                                    });
                                    dfd.resolve(result);
                                });
                        })
                        .catch(function(response) {

                        });
                    return dfd.promise;
                }
            }
        })
        .state('catalog.lineitem', {
            url: '/lineitem/:lineitemid/edit/:specformid',
            views: {
                '': {
                    templateUrl: 'catalog/product/templates/lineitem.edit.tpl.html',
                    controller: 'LineItemEditCtrl',
                    controllerAs: 'product'
                },
                'view@catalog.lineitem': {
                    templateUrl: function($stateParams) {
                        var spec_form = 'default-spec-form';
                        if ($stateParams.specformid) {
                            spec_form = $stateParams.specformid;
                        }
                        return 'catalog/product/templates/spec-forms/' + spec_form + '.tpl.html';
                    },
                    controller: 'LineItemEditCtrl',
                    controllerAs: 'product'
                }
            },
            resolve: {
                LineItem: function($stateParams, Order, OrderCloud) {
                    return OrderCloud.LineItems.Get(Order.ID, $stateParams.lineitemid);
                },
                LI_Product: function(LineItem, OrderCloud) {
                    return OrderCloud.Me.GetProduct(LineItem.ProductID);
                },
                LI_SpecList: function(OrderCloud, $q, LineItem) {
                    var queue = [];
                    var dfd = $q.defer();
                    OrderCloud.Specs.ListProductAssignments(null, LineItem.ProductID)
                        .then(function(data) {
                            angular.forEach(data.Items, function(assignment) {
                                queue.push(OrderCloud.Specs.Get(assignment.SpecID));
                            });
                            $q.all(queue)
                                .then(function(result) {
                                    dfd.resolve(result);
                                });
                        })
                        .catch(function(response) {

                        });
                    return dfd.promise;
                }
            }
        });
}

function OrderInputController($state, appname, $scope, $localForage) {
    var vm = this,
        orderid;
    vm.currentState = $state.current.name;
    vm.price = null;

    $localForage.getItem(appname + '.CurrentOrderID').then(function(data) {
        orderid = data;
    });

    $scope.$on('$stateChangeSuccess', function(event, toState) {
        vm.currentState = toState.name;
    });

    $scope.$watch(function() {
        return vm.Quantity;
    }, function(newValue, oldValue) {
        if (newValue && newValue !== oldValue) {
            var max_quantity = 0;
            angular.forEach($scope.product.item.StandardPriceSchedule.PriceBreaks, function(PriceBreaks) {
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
}

function OCSpecForm() {
    return {
        restrict: 'E',
        scope: {
            product: '='
        },
        templateUrl: 'catalog/product/templates/specform.tpl.html',
        replace: true
    }
}

function SpecSelectionDirective(OrderCloud) {
    return {
        scope: {
            spec: '='
        },
        templateUrl: 'catalog/product/templates/spec.selectionfield.tpl.html',
        link: function(scope) {
            scope.showField = false;
            scope.$watch(function() {
                return scope.spec.OptionID;
            }, function(newVal, oldVal) {
                if (!newVal) return;
                OrderCloud.Specs.GetOption(scope.spec.ID, scope.spec.OptionID)
                    .then(function(specOption) {
                        if (specOption.IsOpenText) {
                            scope.showField = true;
                            scope.spec.Value = null;
                        }
                        else {
                            scope.showField = false;
                        }
                    });
            });
        }
    };
}

function OCAddToOrder() {
    return {
        scope: {
            product: '=',
            formname: '@'
        },
        templateUrl: 'catalog/product/templates/addToOrder.tpl.html',
        controller: 'OrderInputCtrl',
        controllerAs: 'orderInput',
        replace: true
    }
}

function ProductController(Product, SpecList, Order, AddToOrder) {
    var vm = this;
    vm.item = Product;
    vm.order = Order;
    vm.item.Specs = SpecList;

    vm.addToCart = function(product) {
        AddToOrder.Add(product);
    };
}

function LineItemEditController($state, Underscore, LineItem, OrderCloud, LineItemHelpers, LI_Product, LI_SpecList) {
    var vm = this;
    vm.item = LI_Product;
    var originalQuantity = LineItem.Quantity;
    vm.item.Quantity = LineItem.Quantity;
    var originalSpecs = angular.copy(LineItem.Specs);
    vm.item.Specs = LI_SpecList;
    var spec_value = null;
    angular.forEach(vm.item.Specs, function(spec) {
        spec_value = Underscore.where(LineItem.Specs, {SpecID: spec.ID})[0];
        if (spec_value) {
            spec.Value = spec_value.Value;
            spec.OptionID = spec_value.OptionID;
        }
    });

    function findDifferences() {
        var patchObject = {};
        if (vm.item.Quantity !== originalQuantity) {
            patchObject.Quantity = vm.item.Quantity;
        }
        angular.forEach(vm.item.Specs, function(spec) {
            var origSpec = Underscore.where(originalSpecs, {SpecID: spec.ID})[0];
            if (!origSpec || origSpec.Value !== spec.Value || origSpec.OptionID !== spec.OptionID) {
                if(!patchObject.Specs) patchObject.Specs = [];
                patchObject.Specs.push(spec);
            }
        });
        return patchObject;
    }

    vm.UpdateLineItem = function() {
        var patchObj = findDifferences();
        if (patchObj.Quantity || patchObj.Specs) {
            if (patchObj.Specs) patchObj.Specs = LineItemHelpers.SpecConvert(patchObj.Specs);
            OrderCloud.LineItems.Patch(LineItem.OrderID, LineItem.ID, patchObj)
                .then(function() {
                    $state.go('cart')
                });
        }
        else $state.go('cart');
    }
}
