const app = Vue.createApp({
    data() {
        return {
            isHidden: true,
            cart: [],
            };
        },
    
    mounted() {
        // Retrieve cart from session storage on component mount
        const storedCart = sessionStorage.getItem('cart');
        if (storedCart) {
          this.cart = JSON.parse(storedCart);
        }
      },
      computed: {
        totalItemsInCart() {
          return this.cart.reduce((total, item) => total + item.quantity, 0);
        },
        totalPerAsset() {
          const totalPerAsset = {};
          this.cart.forEach(item => {
            totalPerAsset[item.address] = item.price * item.quantity; // Assuming item.price is the price of the asset
          });
          return totalPerAsset;
        },
        totalCartValue() {
          return this.cart.reduce((total, item) => total + item.price * item.quantity, 0);
        },
      },
        methods: {
        removeFromCartCompletely(asset) {
            const existingItem = this.cart.find(item => item.address === asset.address);
            if (existingItem) {
                const index = this.cart.findIndex(item => item.address === asset.address);
                this.cart.splice(index, 1);
              sessionStorage.setItem('cart', JSON.stringify(this.cart));
            }
          },
          getQuantity(asset) {
            const cartItem = this.cart.find(item => item.address === asset.address);
            return cartItem ? cartItem.quantity : 0;
          },
          toggleMenu(){
            this.isHidden = !this.isHidden;
          },
        },
});
app.mount('#checkout')