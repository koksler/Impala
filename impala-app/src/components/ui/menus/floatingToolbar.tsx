import React from 'react';
import { Button } from '../buttons/buttons';
import { Tooltip } from '../Tooltip';
import {
    HandIcon,
    LocateIcon,
    RotateIcon,
    ScaleIcon,
    MagnetSnapIcon,
    LassoIcon,
    BrushIcon,
    EraserIcon,
    CropIcon
} from '../../icons/index';
import { useStore } from '../../../store';
import * as THREE from 'three';

export const FloatingToolbar: React.FC = () => {
    const { activeTool, setActiveTool, snapToGrid, setSnapToGrid, isCropping, setIsCropping } = useStore();

    const handleApplyCrop = () => {
        const viewer = useStore.getState().splatViewer;
        const cropBox = useStore.getState().cropBox;
    
        if (!viewer) return;
        const meshes: any[] = viewer.splatMeshes ?? (viewer.splatMesh ? [viewer.splatMesh] : []);
        if (meshes.length === 0) return;
    
        // Считаем полуширину куба
        const [scaleX, scaleY, scaleZ] = cropBox.scale;
        const hx = scaleX / 2;
        const hy = scaleY / 2;
        const hz = scaleZ / 2;
    
        // Строим матрицу перевода из World Space в Local Space куба
        const euler = new THREE.Euler(...cropBox.rotation);
        const cropRotTrans = new THREE.Matrix4().compose(
            new THREE.Vector3(...cropBox.position),
            new THREE.Quaternion().setFromEuler(euler),
            new THREE.Vector3(1, 1, 1)
        );
        const inverseCropRotTrans = cropRotTrans.clone().invert();
    
        let totalDeleted = 0;
    
        for (const mesh of meshes) {
            mesh.updateMatrixWorld(true);
            const worldToCropLocal = inverseCropRotTrans.clone().multiply(mesh.matrixWorld);
    
            const splatCount: number = mesh.getSplatCount();
            const center = new THREE.Vector3();
            
            // Получаем доступ к низкоуровневому бинарному буферу
            const splatBuffer = mesh.scenes?.[0]?.splatBuffer || mesh.splatBuffer || 
                                (typeof mesh.getSplatBufferForSplat === 'function' ? mesh.getSplatBufferForSplat(0) : null);
            let SplatBufferClass: any = null;
            if (splatBuffer) {
                SplatBufferClass = splatBuffer.constructor;
            }

            for (let i = 0; i < splatCount; i++) {
                mesh.getSplatCenter(i, center);
    
                // Применяем локальный трансформ чанка (если сцена собрана из кусков)
                if (typeof mesh.getSceneTransformForSplat === 'function') {
                    const sceneTransform = mesh.getSceneTransformForSplat(i);
                    if (sceneTransform) center.applyMatrix4(sceneTransform);
                }
    
                // Переводим точку в систему координат нашего CropBox
                center.applyMatrix4(worldToCropLocal);
    
                // Проверяем, вышла ли точка за границы
                const isOutside =
                    Math.abs(center.x) > hx ||
                    Math.abs(center.y) > hy ||
                    Math.abs(center.z) > hz;
    
                if (isOutside) {
                    // 1. ОФИЦИАЛЬНЫЙ АПИ (Если доступно в нашем форке)
                    if (typeof mesh.setSplatDeleted === 'function') {
                        mesh.setSplatDeleted(i, true);
                    }
                    
                    // 2. НИЗКОУРОВНЕВЫЙ МЕТОД (Запись 0 в альфа-канал ArrayBuffer)
                    if (splatBuffer && splatBuffer.bufferData) {
                        let sectionIndex = 0;
                        if (splatBuffer.globalSplatIndexToSectionMap) {
                            sectionIndex = splatBuffer.globalSplatIndexToSectionMap[i];
                        } else if (typeof splatBuffer.globalSplatIndexToSectionIndex === 'function') {
                            sectionIndex = splatBuffer.globalSplatIndexToSectionIndex(i);
                        }
                        
                        const section = splatBuffer.sections ? splatBuffer.sections[sectionIndex] : null;
                        if (section) {
                            const localSplatIndex = i - (section.splatCountOffset || 0);
                            
                            // Определяем смещение цвета. В стандарте это 24 (12 bytes position + 12 bytes scale)
                            let colorOffset = 24; 
                            if (SplatBufferClass?.CompressionLevels && SplatBufferClass.CompressionLevels[splatBuffer.compressionLevel]) {
                                colorOffset = SplatBufferClass.CompressionLevels[splatBuffer.compressionLevel].ColorOffsetBytes || 24;
                            }

                            const srcSplatColorsBase = (section.bytesPerSplat || 32) * localSplatIndex + colorOffset;
                            
                            // Читаем/пишем напрямую в ArrayBuffer по вычисленному смещению
                            const splatColorsArray = new Uint8Array(splatBuffer.bufferData, section.dataBase + srcSplatColorsBase, 4);
                            
                            // Записываем 0 в Альфа-канал (offset 3), делая точку полностью прозрачной!
                            splatColorsArray[3] = 0; 
                        }
                    }

                    totalDeleted++;
                }
            }

            // 3. ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ GPU И СОРТИРОВЩИКА
            // Подтягиваем изменения из splatBuffer в WebGL-текстуры
            if (typeof mesh.refreshGPUDataFromSplatBuffers === 'function') {
                mesh.refreshGPUDataFromSplatBuffers();
            } else if (typeof mesh.updateSplatMesh === 'function') {
                mesh.updateSplatMesh();
            }

            // Перестраиваем Spatial Index / Maps, если поддерживается
            if (typeof mesh.buildSplatIndexMaps === 'function') {
                mesh.buildSplatIndexMaps([splatBuffer]);
            }
        }
        
        // Сигнализируем вьюеру о необходимости рендера нового кадра
        if (typeof viewer.forceRenderNextFrame === 'function') {
            viewer.forceRenderNextFrame();
        }
    
        console.log(`✅ Crop applied: ${totalDeleted} splats removed. GPU Buffers updated. Scene is intact!`);
    };

    const renderTool = (name: string, Icon: any) => {
        const isActive = name === 'snap' ? snapToGrid : name === 'crop' ? isCropping : activeTool === name;
        
        let content = '';
        let hotkey = undefined;
        let position: 'top' | 'bottom' | 'left' | 'right' = 'top';

        switch (name) {
            case 'hand': content = 'Pan View'; hotkey = 'H'; break;
            case 'translate': content = 'Translate Object'; hotkey = 'G'; break;
            case 'rotate': content = 'Rotate Object'; hotkey = 'R'; break;
            case 'scale': content = 'Scale Object'; hotkey = 'S'; break;
            case 'snap': content = 'Snap to Grid'; break;
            case 'lasso': content = 'Lasso Select'; break;
            case 'brush': content = 'Brush Tool'; hotkey = 'B'; break;
            case 'eraser': content = 'Eraser'; hotkey = 'E'; break;
            case 'crop': content = 'Crop Area'; hotkey = 'C'; break;
        }

        return (
            <Tooltip content={content} hotkey={hotkey} position={position}>
                <Button 
                    variant="toggle" 
                    onClick={() => {
                        if (name === 'snap') {
                            setSnapToGrid(!snapToGrid);
                        } else if (name === 'crop') {
                            setIsCropping(!isCropping);
                        } else {
                            setActiveTool(name);
                        }
                    }}
                    className={isActive ? "bg-bg-item border-item-border" : "border-transparent"}
                >
                    <Icon className={`w-6 h-6 ${isActive ? 'text-text-main' : 'text-item-border'}`} />
                </Button>
            </Tooltip>
        );
    };

    return (
        <div className="flex items-center gap-[12px]">
            <div className="flex items-center gap-[6px] bg-bg p-[6px] rounded-[16px] border border-bg-border mb-3">
                {renderTool('hand', HandIcon)}
                {renderTool('translate', LocateIcon)}
                {renderTool('rotate', RotateIcon)}
                {renderTool('scale', ScaleIcon)}
                {renderTool('snap', MagnetSnapIcon)}
            </div>

            <div className="flex items-center gap-[6px] bg-bg p-[6px] rounded-[16px] border border-bg-border mb-3">
                {renderTool('lasso', LassoIcon)}
                {renderTool('brush', BrushIcon)}
                {renderTool('eraser', EraserIcon)}
                {renderTool('crop', CropIcon)}
            </div>

            {isCropping && (
                <div className="flex items-center bg-bg p-[6px] rounded-[16px] border border-bg-border mb-3">
                    <Button 
                        onClick={handleApplyCrop}
                        variant="full"
                    >
                        Apply Crop
                    </Button>
                </div>
            )}
        </div>
    );
};