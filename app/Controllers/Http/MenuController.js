'use strict'

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

const Menu = use('App/Models/Menu')
const Item = use('App/Models/Item')
const Itemstock = use('App/Models/Itemstock')
const Database = use('Database')

const menuStatus = ['Out of Stock', 'Low Stock', 'Available']
class MenuController {
    /**
   * Show a list of all menus.
   * GET menus
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */

/**
 * @swagger
 * /menus/{storeid}:
 *   get:
 *     tags:
 *      - "Menu"
 *     summary: View all menus
 *     description: "List all available menu in the Application"
 *     produces:
 *       - application/json
 *     security:
 *       - Bearer: []
 *     parameters:
 *       - name: storeid
 *         description: Id of the required Store
 *         in: path
 *         required: false
 *         type: integer
 *     responses:
 *       200:
 *         description: All menus
 */
  async index ({ params, response, view }) {
    const menus = await Menu.query()
    .with('items.stores', (builder) => {
        builder.where('store_id', params.storeid)
      })
    .fetch()
    if(params.storeid){
        const menusObj = menus.toJSON();
        menusObj.forEach(menu => {
            menu.status = 2;
            const menuItems = menu.items
            menuItems.forEach(items => {
                const storeStock = items.stores[0]
                const requiredQty = items.pivot.quantity;
                const availableQty = storeStock.pivot.qoh;
                const minQty = storeStock.pivot.min;
                if(availableQty < requiredQty){
                    menu.status = 0;
                }else if(availableQty < minQty && menu.status!== 0){
                    menu.status = 1;
                }

            });
            menu.status = menuStatus[menu.status];
        });
        return menusObj
    }
    return response.json(menus)
  }

  /**
  * @swagger
  * /reduce-item-stock/:
  *   put:
  *     tags:
  *      - "Item Stock"
  *     summary: To Reduce the Item stocks based on the dispenced Order
  *     description: To Reduce the Item stocks based on the dispenced Order
  *     produces:
  *       - application/json
  *     security:
  *       - Bearer: []
  *     parameters:
  *       - name: storeId
   *         description: Id of the Store
   *         in: formData
   *         required: true
   *         type: integer
   *       - name: menuId
   *         description: Id of the Menu
   *         in: formData
   *         required: true
   *         type: integer
   *       - name: orderQty
   *         description: Number of orders made in this Menu Item
   *         in: formData
   *         required: true
   *         type: string
  *     responses:
  *       200:
  *         description: Current orders is updated
  */
 async itemStock ({ request, response }) {
    const storeId = request.input('storeId')
    const menuId = request.input('menuId')
    const orderQty = request.input('orderQty')
    let alerts = [];

    const menus = await Menu.query()
    .where('id', menuId)
    .with('items.stores', (builder) => {
        builder.where('store_id', storeId)
      })
    .first()
    
    const trx = await Database.beginTransaction()
        const menusObj = menus.toJSON();
        const menuItems = menusObj.items
        menuItems.forEach(async items => {
            const storeStock = items.stores[0]
            const useQty = items.pivot.quantity;
            let currentQoh = storeStock.pivot.qoh;
            const minQty = storeStock.pivot.min;
            const newQoh = currentQoh - (useQty * orderQty);

            if(newQoh < minQty){
                alerts.push(items.name + ' is running low on stock')
                //Place order
                //Alert Low stock
            }
            await Itemstock.query()
                .where('id',storeStock.pivot.id)
                .update({qoh: newQoh})

        }, alerts);
    trx.commit();
    let retMsg = {}
    retMsg.message = (alerts.length === 0) ? 'Stock redction success' : alerts
    return response.json(retMsg)

 }
 
 /**
 * @swagger
 * /stock-level/{storeid}:
 *   get:
 *     tags:
 *      - "Item Stock"
 *     summary: Check the stock level for a store
 *     description: "Get the stock level for a particular store"
 *     produces:
 *       - application/json
 *     security:
 *       - Bearer: []
 *     parameters:
 *       - name: storeid
 *         description: Id of the required Store
 *         in: path
 *         required: false
 *         type: integer
 *     responses:
 *       200:
 *         description: All menus
 */
 async stockCheck ({ params, response, view }) {
    const itemstock = await Database
    .raw('SELECT items.name, stock.qoh FROM itemstocks stock INNER JOIN items ON stock.item_id = items.id WHERE stock.qoh < stock.MIN AND stock.store_id = ?', [params.storeid])

    return response.json(itemstock.rows)
 }

 /**
  * @swagger
  * /update-price/:
  *   post:
  *     tags:
  *      - "Menu"
  *     summary: Update menu price
  *     description: To Reduce the Item stocks based on the dispenced Order
  *     produces:
  *       - application/json
  *     security:
  *       - Bearer: []
  *     parameters:
   *       - name: menuid
   *         description: Id of the Menu
   *         in: formData
   *         required: true
   *         type: integer
   *       - name: price
   *         description: New price for the Menu item
   *         in: formData
   *         required: true
   *         type: decimal
  *     responses:
  *       200:
  *         description: Current orders is updated
  */
 async updatePrice ({ request, response, view }) {
    const menuId = request.input('menuid')
    const price = request.input('price')
    const menu = await Menu.query()
    .where('id', menuId)
    .update({price: price})
    let retMsg = {}
    retMsg.message = (menu) ? 'Menu Price updated successfully' : 'Update failed'
    return response.json(retMsg)

 }
}

module.exports = MenuController