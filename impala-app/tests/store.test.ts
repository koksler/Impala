import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../src/store';

describe('useStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useStore.setState({
      customModels: [],
      activeModelId: null,
      objPos: [0, 0.5, 0],
      objRot: [0, 0, 0],
      objScale: [1, 1, 1]
    });
  });

  it('adds a custom model and sets it as active', () => {
    const store = useStore.getState();
    store.addCustomModel({
      id: 'model-1',
      name: 'Test Model',
      url: 'test.glb',
      pos: [1, 2, 3],
      rot: [0, 0, 0],
      scale: [1, 1, 1]
    });

    const newState = useStore.getState();
    expect(newState.customModels).toHaveLength(1);
    expect(newState.activeModelId).toBe('model-1');
    expect(newState.objPos).toEqual([1, 2, 3]);
  });

  it('switches active model correctly', () => {
    const store = useStore.getState();
    store.addCustomModel({
      id: 'model-1',
      name: 'Test Model 1',
      url: 'test1.glb',
      pos: [1, 1, 1],
      rot: [0, 0, 0],
      scale: [1, 1, 1]
    });
    store.addCustomModel({
      id: 'model-2',
      name: 'Test Model 2',
      url: 'test2.glb',
      pos: [2, 2, 2],
      rot: [0, 0, 0],
      scale: [2, 2, 2]
    });

    let state = useStore.getState();
    expect(state.activeModelId).toBe('model-2');
    expect(state.objPos).toEqual([2, 2, 2]);

    state.setActiveModelId('model-1');
    state = useStore.getState();
    expect(state.activeModelId).toBe('model-1');
    expect(state.objPos).toEqual([1, 1, 1]);
  });

  it('updates custom model without changing active state if updating another model', () => {
    const store = useStore.getState();
    store.addCustomModel({
      id: 'model-1',
      name: 'Test Model 1',
      url: 'test1.glb',
      pos: [0, 0, 0],
      rot: [0, 0, 0],
      scale: [1, 1, 1]
    });
    store.addCustomModel({
      id: 'model-2',
      name: 'Test Model 2',
      url: 'test2.glb',
      pos: [2, 2, 2],
      rot: [0, 0, 0],
      scale: [2, 2, 2]
    });

    // Currently active is model-2
    store.updateCustomModel('model-1', { pos: [10, 10, 10] });
    
    const state = useStore.getState();
    // active should still be model-2
    expect(state.activeModelId).toBe('model-2');
    expect(state.objPos).toEqual([2, 2, 2]);
    
    // but model-1 should be updated in the array
    const model1 = state.customModels.find(m => m.id === 'model-1');
    expect(model1?.pos).toEqual([10, 10, 10]);
  });
});
