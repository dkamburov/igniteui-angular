import { Component, Renderer, OnInit, Input, Output, EventEmitter, ViewChild, TemplateRef, ElementRef, ComponentRef, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { VerticalChunkComponent } from './vertical-chunk.component';
import { VirtualRow } from './virtual-row.interface';
import { VirtualCell } from './virtual-cell.interface';

@Component({
  selector: 'virtual-container',
  styleUrls: ['./virtual-container.component.css'],
  template:
    `<div #mainContainer class="mainContainer" [ngStyle]="{width: containerWidth, height: containerHeight}" >
      <div #displayContainer class="displayContainer" [ngStyle]="{width: containerWidth, height:containerHeight}" (mousemove)="onMouseMoveContent($event)" (wheel)="onWheelContent($event)">
        <ng-template #chunksContainer></ng-template>
        <div *ngIf="enableScrollbars" [ngStyle]="{width: '10000px', height: '10000px'}"></div>
      </div>
      <div #scrollContainer class="scrollContainer" [ngStyle]="{width: containerWidth, height: containerHeight, overflow: enableScrollbars ? 'auto' : 'hidden'}" (scroll)="onScroll($event)" (mousemove)="onMouseMoveScroll($event)">
        <div class="scrollInner" [ngStyle]="{width: contentWidth + 'px', height: contentHeight + 'px'}" ></div>
      </div>
    </div>`
})
export class VirtualContainerComponent implements OnInit {
  @Input() containerWidth: string;
  @Input() containerHeight: string;
  @Input() cols: Array<{
    field: string,
    width: string
  }>;
  @Input() data: Array<Object>;
  @Input() horizontalItemWidth: number;
  @Input() verticalItemHeight: number;
  @Input() rowComponent: any;
  @Input() cellComponent: any;
  @Input() rowDefaults: any;
  @Input() cellDefaults: any;
  @Input() enableScrollbars = true;
  @Input() bindScrollTo: ElementRef;

  @Output() virtScroll = new EventEmitter();
  @Output() chunksRendered = new EventEmitter();

  @ViewChild('mainContainer') mainContainer;
  @ViewChild('displayContainer') displayContainer;
  @ViewChild('scrollContainer') scrollContainer;
  @ViewChild('chunksContainer', {read: ViewContainerRef}) chunksContainer: ViewContainerRef; 

  private maxRowWidth: number;
  private contentWidth: number;
  private contentHeight: number;
  private lastScrollTop: number;
  private lastScrollLeft: number;
  private accScrollTop: number;
  private accScrollLeft: number;

  private vChunkNumRows: number;
  private _renderRestChunksTimer: any;
  private curStartColIndex: number;
  private curEndColIndex: number;

  public cells: Array<Array<{
    colIndex: number,
    elem:  ComponentRef<{}>
  }>>;
  public rows: Array<{
    rowIndex: number,
    elem: ComponentRef<{}>
  }>;

  constructor(private renderer:Renderer, private componentFactoryResolver: ComponentFactoryResolver) {
    this.cols = [];
    this.data = [];
    this.horizontalItemWidth = 100,
    this.verticalItemHeight = 25
    this.contentWidth = 0;
    this.contentHeight = 0;
    this.lastScrollTop = 0
    this.lastScrollLeft = 0;
    this.accScrollTop = 0;
    this.accScrollLeft = 0;
    this.curStartColIndex = 0;
    this.curEndColIndex = 0;

    this.rows = [];
    this.cells = [];
   }

  ngOnInit() {
    this.calculateTotalSize();
  }

  ngAfterViewInit() {
    this.displayContainer.nativeElement.style.top = "0px";
    this.displayContainer.nativeElement.style.left = "0px";

    this.createInitView();

    //this.chunksRendered.emit({
      //rows: this.previousChunk.instance.rows.concat(this.currentChunk.instance.rows).concat(this.nextChunk.instance.rows)
    //});

    if(!this.bindScrollTo) {
      this.bindScrollTo = this.scrollContainer;
    }
    this.bindScrollTo.nativeElement.addEventListener('scroll', this.onScroll, false);
  }

  calculateTotalSize() {
    for(let i=0; i < this.cols.length; i++) {
      this.contentWidth += parseInt(this.cols[i].width);
    }

    for(let i=0; i < this.data.length; i++) {
      this.contentHeight += this.verticalItemHeight;
    }

    this.vChunkNumRows = Math.floor(parseInt(this.containerHeight) / this.verticalItemHeight) + 1;
  }

  sliceColumns(row, startIndex, endIndex) {
    var slicedCols = {},
        keys = Object.keys(row);

    for(let j = startIndex; j < endIndex; j++) {
      slicedCols[keys[j]] = row[keys[j]];
    }
    
    return slicedCols;
  }
  
  createCellStart(value, column, rowRef) {
    var cellComponentFactory = this.componentFactoryResolver.resolveComponentFactory(this.cellComponent);  
    var newCell =  (<VirtualRow>rowRef.instance).rowContent.createComponent(cellComponentFactory, 0);
    (<VirtualCell>newCell.instance).height = this.verticalItemHeight;
    (<VirtualCell>newCell.instance).width = column.width;
    (<VirtualCell>newCell.instance).defaultOptions = this.cellDefaults;
    (<VirtualCell>newCell.instance).value = value;
    (<VirtualCell>newCell.instance).row = rowRef.instance;
    newCell.hostView.detectChanges();

    return newCell;
  }

  createCellEnd(value, column, rowRef) {
    var cellComponentFactory = this.componentFactoryResolver.resolveComponentFactory(this.cellComponent);  
    var newCell =  (<VirtualRow>rowRef.instance).rowContent.createComponent(cellComponentFactory);
    (<VirtualCell>newCell.instance).height = this.verticalItemHeight;
    (<VirtualCell>newCell.instance).width = column.width;
    (<VirtualCell>newCell.instance).defaultOptions = this.cellDefaults;
    (<VirtualCell>newCell.instance).value = value;
    (<VirtualCell>newCell.instance).row = rowRef.instance;
    newCell.hostView.detectChanges();

    return newCell;
  }

  createRowStart(rowData, startColIndex, endColIndex) {
    var rowComponentFactory = this.componentFactoryResolver.resolveComponentFactory(this.rowComponent),
      colsData = this.cols.slice(startColIndex, endColIndex + 1),
      cellsData = this.sliceColumns(rowData, startColIndex, endColIndex + 1),
      rowNativeCells = [];

    let newRow = this.chunksContainer.createComponent(rowComponentFactory, 0);
    (<VirtualRow>newRow.instance).height = this.verticalItemHeight;
    (<VirtualRow>newRow.instance).width = this.maxRowWidth;
    (<VirtualRow>newRow.instance).defaultOptions = this.rowDefaults;

    this.cells.unshift([]);
    for(let i = 0; i < colsData.length; i++) {
      let newCell = this.createCellEnd(cellsData[colsData[i].field], colsData[i], newRow);
      
      rowNativeCells.push(newCell.location.nativeElement);
      this.cells[0].push({
        colIndex: startColIndex + i,
        elem: newCell
      });
    }

    newRow.hostView.detectChanges();
    return newRow;
  }

  createRowEnd(rowData, startColIndex, endColIndex) {
    var rowComponentFactory = this.componentFactoryResolver.resolveComponentFactory(this.rowComponent),
      colsData = this.cols.slice(startColIndex, endColIndex + 1),
      cellsData = this.sliceColumns(rowData, startColIndex, endColIndex + 1),
      newCellsIndex = this.cells.length,
      rowNativeCells = [];

    let newRow = this.chunksContainer.createComponent(rowComponentFactory);
    (<VirtualRow>newRow.instance).height = this.verticalItemHeight;
    (<VirtualRow>newRow.instance).width = this.maxRowWidth;
    (<VirtualRow>newRow.instance).defaultOptions = this.rowDefaults;

    this.cells.push([]);
    for(let i = 0; i < colsData.length; i++) {
      let newCell = this.createCellEnd(cellsData[colsData[i].field], colsData[i], newRow);
      
      rowNativeCells.push(newCell.location.nativeElement);
      this.cells[newCellsIndex].push({
        colIndex: startColIndex + i,
        elem: newCell
      });
    }
    
    newRow.hostView.detectChanges();
    return newRow;
  }

  createInitView() {
    var initData = this.data.slice(0, this.vChunkNumRows + 1),
      curLength = 0,
      containerWidth = parseInt(this.containerWidth);

    for(let i = this.curStartColIndex; i < this.cols.length; i++) {
      if(curLength > containerWidth) {
        this.curEndColIndex = i;
        break;
      }
      curLength += parseInt(this.cols[i].width);
    }

    let newRow = this.createRowEnd(initData[0], this.curStartColIndex, this.curEndColIndex);
    this.rows.push({
      rowIndex: 0,
      elem: newRow
    });

    //We do it backwards because createComponent needs to have index specified, and we use 0 there for each new row and they are added on top
    for(let i = 0; i < initData.length; i++) {
      let newRow = this.createRowEnd(initData[i], this.curStartColIndex, this.curEndColIndex);
      this.rows.push({
        rowIndex: i,
        elem: newRow
      });
    }

    this.displayContainer.nativeElement.style.top = -this.verticalItemHeight + "px";
  }

  loadNextRow() {
    var newRow, oldRow, oldCells,
      newRowIndex = this.rows[this.rows.length - 1].rowIndex + 1,
      newRowData = this.data[newRowIndex];

    if(!newRowData) {
      newRowIndex = this.data.length - 1;
      newRowData = this.data[newRowIndex];
    }

    oldRow = this.rows.shift();
    oldCells = this.cells.shift();

    //clear old cells and the row itself
    for(let i = 0; i < oldCells.length; i++) {
      oldCells[i].elem.hostView.destroy();
      oldCells[i].elem.destroy();
    }
    oldRow.elem.hostView.destroy();
    oldRow.elem.destroy();
    
    //new row creation
    newRow = this.createRowEnd(newRowData, this.curStartColIndex, this.curEndColIndex);
    this.rows.push({
      rowIndex: newRowIndex,
      elem: newRow
    });
  }

  loadPrevRow() {
    var newRow, oldRow, oldCells,
      newRowIndex = this.rows[0].rowIndex - 1,
      newRowData = this.data[newRowIndex];

    if(!newRowData) {
      newRowIndex = 0;
      newRowData = this.data[newRowIndex];
      this.displayContainer.nativeElement.style.top = -this.verticalItemHeight + "px";
    }

    oldRow = this.rows.pop();
    oldCells = this.cells.pop();

    //clear old cells and the row itself
    for(let i = 0; i < oldCells.length; i++) {
      oldCells[i].elem.hostView.destroy();
      oldCells[i].elem.destroy();
    }
    oldRow.elem.hostView.destroy();
    oldRow.elem.destroy();
    
    //new row creation
    newRow = this.createRowStart(newRowData, this.curStartColIndex, this.curEndColIndex);
    this.rows.unshift({
      rowIndex: newRowIndex,
      elem: newRow
    });
  }

  
  fixUpdateAllRows(scrollTop) {
    var startIndex = Math.floor(scrollTop / this.verticalItemHeight),
      endIndex = startIndex + this.rows.length,
      rowsData = this.data.slice(startIndex, endIndex),
      colsData = this.cols.slice(this.curStartColIndex, this.curEndColIndex + 1);
    
    for(let i = 0; i < this.cells.length; i++) {
      let cellsData;
      this.rows[i].rowIndex = startIndex + i;
      if(!rowsData[i] && startIndex < 0) {
        cellsData = this.sliceColumns(rowsData[0], this.curStartColIndex, this.curEndColIndex + 1);
      } else if(!rowsData[i] && endIndex >= this.data.length) {
        cellsData = this.sliceColumns(rowsData[rowsData.length - 1], this.curStartColIndex, this.curEndColIndex + 1);
      } else{
        cellsData = this.sliceColumns(rowsData[i], this.curStartColIndex, this.curEndColIndex + 1);
      }

      for(let j = 0; j < this.cells[i].length; j++) {
        (<VirtualCell>this.cells[i][j].elem.instance).value = cellsData[colsData[j].field];
      }
    }
  }

  removeRightCol(){
    var oldCell;
    for(let i = 0; i < this.cells.length; i++) {
      oldCell = this.cells[i].pop();
      oldCell.elem.hostView.destroy();
      oldCell.elem.destroy();
    }
    this.curEndColIndex--;
  }

  removeLeftCol() {
    var oldCell;
    for(let i = 0; i < this.cells.length; i++) {
      oldCell = this.cells[i].shift();
      oldCell.elem.hostView.destroy();
      oldCell.elem.destroy();
    }
    this.curStartColIndex++;
  }

  addRightCol() {
    var newCell,
      newColIndex = this.cells[0][this.cells[0].length - 1].colIndex + 1,
      newColField;

    if(!this.cols[newColIndex]) {
      return false;
    }
    
    newColField = this.cols[newColIndex].field
    for(let i = 0; i < this.rows.length; i++) {
      let rowIndex = this.rows[i].rowIndex;
      newCell = this.createCellEnd(this.data[rowIndex][newColField], this.cols[newColIndex], this.rows[i].elem);
      this.cells[i].push({
        colIndex: newColIndex,
        elem:  newCell
      });
    }

    this.curEndColIndex++;
    return true;
  }

  addLeftCol() {
    var newCell,
      newColIndex = this.cells[0][0].colIndex - 1,
      newColField;

    if(!this.cols[newColIndex]) {
      return false;
    }

    newColField = this.cols[newColIndex].field
    for(let i = 0; i < this.rows.length; i++) {
      let rowIndex = this.rows[i].rowIndex;
      newCell = this.createCellStart(this.data[rowIndex][newColField], this.cols[newColIndex], this.rows[i].elem);
      this.cells[i].unshift({
        colIndex: newColIndex,
        elem:  newCell
      });
    }

    this.curStartColIndex--;
    return true;
  }
  
  fixUpdateAllCols(scrollLeft) {
    var colsData,
      curWidth = 0;

    for(let i = 0; i < this.cols.length; i++) {
      curWidth += parseInt(this.cols[i].width);

      if(curWidth > scrollLeft) {
        this.curStartColIndex = i;
        break;
      }
    }

    curWidth = 0;
    for(let i = this.curStartColIndex; i < this.cols.length; i++) {
      curWidth += parseInt(this.cols[i].width);

      if(curWidth > parseInt(this.containerWidth) * 1.2) {
        this.curEndColIndex = i;
        break;
      }
    }

    colsData = this.cols.slice(this.curStartColIndex, this.curEndColIndex + 1);
    this.updateCells(colsData);
  }

  getColIndex(colField: string) {
    var i;
    for(i = 0; i < this.cols.length; i++) {
      if(this.cols[i].field === colField) {
        break;
      }
    }

     return i;
  }

  updateCells(cols: Array<{field: string, width: string}>) {
    var startColIndex = this.getColIndex(cols[0].field);
    //Update cells, if exceeding the currently created amount create new cells
    for (let colIndex = 0; colIndex < cols.length; colIndex++) {
      if(colIndex < this.cells[0].length) {
        for(let rowIndex = 0; rowIndex < this.rows.length; rowIndex++) {
          let dataRowIdx = this.rows[rowIndex].rowIndex;
          this.cells[rowIndex][colIndex].colIndex = startColIndex + colIndex;
          (<VirtualCell>this.cells[rowIndex][colIndex].elem.instance).width = parseInt(cols[colIndex].width);
          (<VirtualCell>this.cells[rowIndex][colIndex].elem.instance).value = this.data[dataRowIdx][cols[colIndex].field];
        }
      } else {
        for(let rowIndex = 0; rowIndex < this.rows.length; rowIndex++) {
          let dataRowIdx = this.rows[rowIndex].rowIndex;
          let newCell = this.createCellEnd(this.data[dataRowIdx][cols[colIndex].field], cols[colIndex], this.rows[rowIndex].elem);
          this.cells[rowIndex].push({
            colIndex: startColIndex + colIndex,
            elem: newCell
          });
        }
      }
    }

    //Remove any extra cells at the end
    if (this.cells[0].length > cols.length) {
      let numToRemove = this.cells[0].length - cols.length;
      for(let rowIndex = 0; rowIndex < this.rows.length; rowIndex++) {
        for (let i = 0; i < numToRemove; i++) {
          let oldCell = this.cells[rowIndex].pop();
          oldCell.elem.hostView.destroy();
          oldCell.elem.destroy();
        }
      }
    }
  }

  onScroll = (event) => {
    var newVChunkIndex, newHChunkIndex,
        curScrollTop = event.target.scrollTop,
        curScrollLeft = event.target.scrollLeft,
        vDir = Math.sign(curScrollTop - this.lastScrollTop),
        hDir = Math.sign(curScrollLeft - this.lastScrollLeft);

    this.virtScroll.emit({scrollTop: curScrollTop, scrollLeft: curScrollLeft});

    //Updating vertical chunks
    if(curScrollTop != this.lastScrollTop &&
      (this.rows.length - 1) * this.verticalItemHeight > parseInt(this.containerHeight)) {
      let numToRender = 0;

      this.accScrollTop += curScrollTop - this.lastScrollTop;
      numToRender = Math.floor(Math.abs(this.accScrollTop) / this.verticalItemHeight);

      if(Math.abs(curScrollTop - this.lastScrollTop) <= this.verticalItemHeight) {
        let newTop = parseInt(this.displayContainer.nativeElement.style.top) - (curScrollTop - this.lastScrollTop);
        this.displayContainer.nativeElement.style.top =  newTop + "px";
      }
      
      if(numToRender >= 1) {
        this.accScrollTop = this.accScrollTop % this.verticalItemHeight;

        if(Math.abs(curScrollTop - this.lastScrollTop) < parseInt(this.containerHeight)) {
          this.displayContainer.nativeElement.style.top = Math.sign(vDir) * (-this.accScrollTop) + "px";

          for(let i = 0 ; i < numToRender; i ++) {
            if(vDir >= 0) {
              this.loadNextRow();
            } else {
              this.loadPrevRow();
            }
          }
        } else {
          this.fixUpdateAllRows(curScrollTop);
          this.displayContainer.nativeElement.style.top = "0px";
        }
      }
    }

    //Updating horizontal chunks
    if(curScrollLeft != this.lastScrollLeft) {
      let virtScrollLeft = parseInt(this.displayContainer.nativeElement.style.left),
        renderedWidth = 0;

      this.accScrollLeft += curScrollLeft - this.lastScrollLeft;

      if(Math.abs(curScrollLeft - this.lastScrollLeft) <= parseInt(this.containerWidth)) {
        let newLeft = parseInt(this.displayContainer.nativeElement.style.left) - (curScrollLeft - this.lastScrollLeft);
        this.displayContainer.nativeElement.style.left =  newLeft + "px";
        virtScrollLeft = newLeft;

        for(let i = this.curStartColIndex; i <= this.curEndColIndex; i++) {
          renderedWidth +=  parseInt(this.cols[i].width);
        }

        if(hDir >= 0) {
          let widthToRemove = 0, widthRemoved = 0, numRemoved = 0,
            widthToRender = 0, widthRendered = 0;

          //Remove cols out of view on the left
          widthToRemove = Math.abs(virtScrollLeft);
          for(let i = this.curStartColIndex; i <= this.curEndColIndex; i++) {
            let colWidth = parseInt(this.cols[i].width);

            widthRemoved += colWidth;
            if(widthRemoved < Math.abs(virtScrollLeft)) {
              this.removeLeftCol();
              numRemoved++;
              renderedWidth -= colWidth;
            } else{
              widthRemoved -= colWidth;
              break;
            }
          }

          //Render needed cols
          widthToRender = parseInt(this.containerWidth) * 1.2 - (renderedWidth - this.accScrollLeft);
          if(widthToRender) {
            for(let i = this.curEndColIndex; i < this.cols.length; i++) {
              if(widthRendered >= widthToRender) {
                break;
              } else {
                this.addRightCol();
                widthRendered += parseInt(this.cols[i].width);
              }
            }
          }

          if(numRemoved) {
            this.accScrollLeft -= widthRemoved;
            this.displayContainer.nativeElement.style.left =  (-this.accScrollLeft) + "px";
          }
        } else {
          let widthToRemove,
            widthRemoved = 0, numRendered = 0,
            widthToRender = 0, widthRendered = 0;

          //Remove cols out of view on the right
          widthToRemove = renderedWidth - (parseInt(this.containerWidth) - virtScrollLeft);
          for(let i = this.curEndColIndex; i >= this.curStartColIndex; i--) {
            let colWidth = parseInt(this.cols[i].width);

            widthRemoved += colWidth;
            if(widthRemoved < widthToRemove) {
              this.removeRightCol();
              renderedWidth -= colWidth;
            } else{
              break;
            }
          }

          //Render needed cols
          widthToRender = parseInt(this.containerWidth) * 1.2 - (parseInt(this.containerWidth) - virtScrollLeft);
          if(widthToRender > 0) {
            for(let i = this.curStartColIndex - 1; i >= 0; i--) {
              if(widthRendered >= widthToRender) {
                break;
              } else {
                this.addLeftCol();
                widthRendered += parseInt(this.cols[i].width);
                numRendered++;
              }
            }
          }

          if(numRendered) {
            this.accScrollLeft = widthRendered - virtScrollLeft;
            this.displayContainer.nativeElement.style.left =  (-this.accScrollLeft) + "px";
          }
        }
      } else {
        this.fixUpdateAllCols(curScrollLeft);
        this.accScrollLeft = 0;
        this.displayContainer.nativeElement.style.left = "0px";
      }
    }
    
    //Cache data for the next scroll
    this.lastScrollTop = curScrollTop;
    this.lastScrollLeft = curScrollLeft;
  }

  onMouseMoveScroll(event) {
    if (event.layerX < parseInt(this.containerWidth) - 17 && 
        event.layerY < parseInt(this.containerHeight) - 17 &&
        event.offsetX - 2 <= event.layerX && event.layerX <= event.offsetX + 2 &&
        event.offsetY - 2 <= event.layerY && event.layerY <= event.offsetY + 2 &&
        this.scrollContainer.nativeElement.style.pointerEvents !== "none") {
      this.scrollContainer.nativeElement.style.pointerEvents = "none";
    }
  }

  onMouseMoveContent(event) {
    if (/Edge/.test(navigator.userAgent)) {
      if ((event.layerX > parseInt(this.containerWidth) - 17 || 
          event.layerY > parseInt(this.containerHeight) - 17) && 
          this.scrollContainer.nativeElement.style.pointerEvents !== "auto") {
        this.scrollContainer.nativeElement.style.pointerEvents = "auto";
      }
    } else {
      if ((event.layerX + parseInt(this.displayContainer.nativeElement.style.left) > parseInt(this.containerWidth) - 17 || 
          event.layerY + parseInt(this.displayContainer.nativeElement.style.top) > parseInt(this.containerHeight) - 17) && 
          this.scrollContainer.nativeElement.style.pointerEvents !== "auto") {
        this.scrollContainer.nativeElement.style.pointerEvents = "auto";
      }
    }
  }

  onWheelContent(event) {
    var scrollDeltaY;

    if (event.wheelDeltaY) {
      /* Option supported on Chrome, Safari, Opera.
      /* 120 is default for mousewheel on these browsers. Other values are for trackpads */
      scrollDeltaY = -event.wheelDeltaY / 120;
    } else if (event.deltaY) {
      /* For other browsers that don't provide wheelDelta, use the deltaY to determine direction and pass default values. */
      scrollDeltaY = event.deltaY > 0 ? 1 : -1;
    }

    if (/Edge/.test(navigator.userAgent)) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollTop + event.deltaY / 3;
    } else {
      this.smoothWheelScrollY(scrollDeltaY);
    }
    this.scrollContainer.nativeElement.scrollLeft = this.scrollContainer.nativeElement.scrollLeft + event.deltaX;
    
    return false;
  }

  smoothWheelScrollY(deltaY: number) {
    var self = this,
      smoothingStep = 2,
      smoothingDuration = 0.5,
      animationId;

    //We use the formula for parabola y = -3*x*x + 3 to simulate smooth inertia that slows down
    var x = -1;
    function inertiaStep() {
      if (x > 1) {
        cancelAnimationFrame(animationId);
        return;
      }

      let nextY = ((-3 * x * x + 3) * deltaY * 2) * smoothingStep;
      self.scrollContainer.nativeElement.scrollTop = self.scrollContainer.nativeElement.scrollTop + nextY;

      //continue the intertia
      x += 0.08 * (1 / smoothingDuration);
      animationId = requestAnimationFrame(inertiaStep);
    }

    animationId = requestAnimationFrame(inertiaStep);
  }

  gOnDestroy() {
      this.bindScrollTo.nativeElement.removeEventListener('scroll', this.onScroll, false);
  }
}
