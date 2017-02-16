/*
author: Layer <gai00layer@gmail.com>
version: 1.0.6
change logs:
  1.0.6
    增加store.getStore()，來讓agent可以快速取得自己的store。
  1.0.5
    修復store.agent的namespace問題，還有將store的storePath的起點設為空字串。
  1.0.4
    增加版本號，修復event的namespace問題。
  1.0.3
    store.update修復為原本預想的，只有呼叫一次事件，而且只給有變更的部分資料
  1.0.2
    支援set({obj}) 等同 set('', {obj})
  1.0.1
    store.update的callback參數updateData現在不會回傳全部資料，而是有變更的部分資料。
*/

// update用
import React from 'react';

import {Events} from './events';
/*
設計概念:
一個根部，然後假如在取得agent的時候，
產生一個store Reducer(指樹狀根部往上分枝的節點，英文是指兩根管子的接頭)

最好的使用情境就是將store tree(指一個樹狀的結構從某個節點開始往上)包裝起來
但是裡面的資料長的不太一樣之類的。

具備可擴充性這樣就會比較好用了。
目前預設是要擴充events

實作起來大概就是storeData裡面的樹狀結構，會跟getAgent裡面的樹狀結構類似。
所以
var a = store.getAgent('a');
store.getAgent('a.b.c') === a.getAgent('b.c');
*/
export class Store {
  // 版本號
  VERSION = '1.0.6';
  
  // static properties
  static storeNamespaces = {};
  
  // static methods
  static getStore(namespace) {
    namespace = namespace || 'store';
    if(!this.storeNamespaces[namespace]) {
      // update 20170216: 這邊預設root路徑為空字串
      let newStore = new this({});
      // let newStore = new this({}, namespace);
      newStore.namespace = namespace;
      this.storeNamespaces[namespace] = newStore;
    }
    return this.storeNamespaces[namespace];
  }
  
  // properties
  storeData = {};
  storePath = '';
  namespace = '';
  agents = {};
  
  // 套入event
  events;
  
  // methods
  // 建構子
  constructor(storeData, storePath) {
    this.storeData = storeData = storeData || {};
    this.storePath = storePath = storePath || '';
    
    // 套入events
    var eventsName = 'events';
    if(storePath) {
       eventsName += '.';
    }
    eventsName += storePath;
    this.events = Events.getEvents(eventsName);
    this.events.bind(this);
  }
  
  // 同時具備getter跟setter以及trace功能的函數
  access(target, dataPath, data) {
    var isSet = (data !== undefined);
    
    // 假如沒有path就回傳target或者循序賦值
    if(!dataPath) {
      // get
      if(!isSet) {
        return target;
      }
      // set
      else {
        for(let key in data) {
          target[key] = data[key];
        }
        return;
      }
    }
    
    // 有路徑的部分
    var pathParts = dataPath.split('.');
    for(let index = 0; index < pathParts.length; index += 1) {
      let part = pathParts[index];
      
      // 假如是倒數第一個就看是不是set模式
      if(target && isSet && index === pathParts.length - 1) {
        target[part] = data;
        break;
      }
      else if(target[part] != undefined) {
        target = target[part];
      }
      // 代表不存在該物件，但確實存在
      else if(isSet) {
        target = target[part] = {};
      }
      // 找不到就設定undefined並跳出
      else {
        target = undefined;
        break;
      }
    }
    
    return target;
  }
  
  // 從storeData中讀取資料
  get(dataPath) {
    return this.access(this.storeData, dataPath);
  }
  
  // 設定storeData資料
  set(dataPath, data) {
    // 給預設值
    dataPath = dataPath || '';
    
    // update 20160518: 更新支援dataPath為物件資料的話
    if(typeof dataPath == 'object') {
      data = dataPath;
      dataPath = '';
    }
    
    this.access(this.storeData, dataPath, data);
    
    // 觸發事件
    var updateData = {};
    var current = updateData;
    var pathParts = dataPath.split('.');
    
    // 有路徑的話
    if(!dataPath) {
      updateData = data;
    }
    // 沒路徑
    else {
      for(let index = 0; index < pathParts.length; index += 1) {
        let part = pathParts[index];
        
        // 不是最後的話
        if(index < pathParts.length - 1) {
          current = updateData[part] = updateData[part] || {};
        }
        else {
          current[part] = data;
        }
      }
    }
    
    this.emit('update', [updateData]);
  }
  
  // 使用react的addons
  update(updateQuery) {
    var data = this.get();
    
    data = React.addons.update(data, updateQuery);
    
    // 分別設定到各欄位
    var isGlobal = false;
    var parts = {};
    for(let key in updateQuery) {
      // 第一層有指令則代表global
      if(key[0] == '$') {
        isGlobal = true;
      }
      // 資料
      else {
        parts[key] = data[key];
      }
    }
    
    // global就直接set回去
    if(isGlobal) {
      this.set('', data);
    }
    // 否則則一個一個part更新回去
    else {
      // update 20160519: 變成局部物件emit一次事件，而不是全部各一次
      var updateData = {};
      for(let key in parts) {
        this.access(this.storeData, key, parts[key]);
        updateData[key] = parts[key];
      }
      // 觸發事件
      this.emit('update', [updateData]);
    }
  }
  
  // update 20170216: 取得store
  getStore() {
    return Store.getStore(this.namespace);
  }
  
  // 取得agent
  getAgent(agentPath) {
    // update 20160518: 增加預設值為空字串，回傳自己
    agentPath = agentPath || '';
    if(!agentPath) {
      return this;
    }
    
    var pathParts = agentPath.split('.');
    var targetAgent = this;
    // 概念是循序的從a.b.c > "a", a."b", a.b."c" 這樣找上去
    for(let index = 0; index < pathParts.length; index += 1) {
      let part = pathParts[index];
      
      // 確認資料
      let agentData = targetAgent.get(part);
      if(typeof agentData != 'object' && agentData !== undefined) {
        throw Error("Cannot create new agent at specify path. storeData is exists and it isn't object.");
      }
      
      // check agent
      let agent = this.access(targetAgent.agents, part);
      if(agent === undefined) {
        let newAgentPath = targetAgent.storePath;
        if(newAgentPath.length > 0) {
          newAgentPath += '.';
        }
        newAgentPath += part;
        
        agentData = agentData || {};
        // 設定資料
        targetAgent.set(part, agentData);
        // update 20170216: 設定agent並設定namespace
        agent = new Store(agentData, newAgentPath);
        agent.namespace = this.namespace;
        
        this.access(targetAgent.agents, part, agent);
      }
      
      targetAgent = agent;
    }
    
    return targetAgent;
  }
}

export default Store.getStore();