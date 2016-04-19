angular.module('orderCloud')

    .config(CategoryConfig)
    .controller('CategoryCtrl', CategoryController)

;

function CategoryConfig($stateProvider) {
    $stateProvider
        .state('catalog.category', {
            url: '/category/:categoryid',
            templateUrl: 'catalog/category/templates/category.tpl.html',
            controller: 'CategoryCtrl',
            controllerAs: 'category',
            resolve: {
                CategoryList: function(OrderCloud, $stateParams) {
                    return OrderCloud.Me.ListSubcategories($stateParams.categoryid);
                },
                ProductList: function(OrderCloud, $stateParams) {
                    return OrderCloud.Me.ListProducts(null, $stateParams.categoryid);
                }
            }
        });
}

function CategoryController(CategoryList, ProductList) {
    var vm = this;
    vm.categories = CategoryList;
    vm.products = ProductList;
}
