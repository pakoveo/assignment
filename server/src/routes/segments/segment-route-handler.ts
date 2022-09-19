import { Request, Response } from "express";
import { handleResponseError } from "../route-handlers/route-error-handler";
import { Collection, ObjectId } from "mongodb";
import {
  ISegment,
  ISegmentGenderData,
  ISegmentMetaData,
} from "../../common/types/db-models/segment";
import { getDbWrapper } from "../../common/db/mongo-wrapper";
import { Gender, IncomeType } from "../../common/types/db-models/user";
import { promises } from "dns";

export async function segmentList(req: Request, res: Response): Promise<void> {
  try {
    const segmentCollection: Collection = await getDbWrapper().getCollection("segments");
    const userCollection: Collection = await getDbWrapper().getCollection('users');

    const skip = +req.query.skip
    const limit = +req.query.limit
    const query = req.query.search ? { name: { $regex: req.query.search } } : {}

    const [segmentsCount, segmentList] = await Promise.all([
       segmentCollection.countDocuments(query),
       segmentCollection.find(query).limit(limit).skip(skip).toArray()
    ])

    let [ userCountArray, incomeData, genderData] = await Promise.all([
      Promise.all(segmentList.map(segment => userCollection.countDocuments({ segment_ids: segment._id }))),
      
      Promise.all(segmentList.map(segment => userCollection.aggregate([
        { $match: { segment_ids: segment._id }},
        { $project: { income_level: 1, income_type: 1}},
        { $group: { _id:'$income_type', totalIncome: { $sum:"$income_level"}}},
        ]).toArray())),

      Promise.all(segmentList.map(segment => userCollection.aggregate([
        { $match: { segment_ids: segment._id } },
        { $project: { gender: 1}},
        { $group: { _id:'$gender', userCount: { $sum:1 }}},
        { $sort: { userCount: -1 } },
        { $limit: 1 } 
        ]).toArray()))
    ])

    const avgIncome = incomeData.map( (segmentIncome, index) => {
      let sum = 0;

      segmentIncome.forEach( income => {
        income._id === IncomeType.Monthly ?
          sum += income.totalIncome :
          sum += income.totalIncome / 12;
        });
      
      return sum / userCountArray[index]
    })

    const topGender: Gender[] = genderData.map(gender => gender[0]._id);
   
    const metaData: ISegmentMetaData[] =  userCountArray.map((userCount, index)=>({
      ...segmentList[index], 
      avgIncome: avgIncome[index].toFixed(2), 
      userCount: userCount,
      topGender: topGender[index]
    }))

    res.json({ success: true, totalCount: segmentsCount, data: metaData });

    // I couldn't manage to get the topGender and avgIncome data in short time, it's taking time but eventually the data coming :).

  } catch (error) {
    handleResponseError(
      `Get Segment List Error: ${error.message}`,
      error.message,
      res
    );
  }
}

export async function getSegmentById(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const segmentCollection: Collection = await (
      await getDbWrapper()
    ).getCollection("segments");
    const segment: ISegment = await segmentCollection.findOne({
      _id: new ObjectId(req.params.id as string),
    });
    if (!segment) {
      return handleResponseError(
        `Error getSegmentById`,
        `Segment with id ${req.params.id} not found.`,
        res
      );
    }
    res.json({ success: true, data: segment });
  } catch (error) {
    handleResponseError(
      `Get Segment by id error: ${error.message}`,
      error.message,
      res
    );
  }
}

export async function updateSegmentById(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // res.json({ success: true });
  } catch (error) {
    handleResponseError(
      `Update Segment by id error: ${error.message}`,
      error.message,
      res
    );
  }
}

export async function getSegmentGenderData(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userCollection: Collection = await getDbWrapper().getCollection('users');
    let data:ISegmentGenderData[] = [];

    let [ totalUsers, genderData ] = await Promise.all([
      userCollection.countDocuments({ segment_ids: new ObjectId(req.params.id as string) }),
      userCollection.aggregate([
        { $match: { segment_ids: new ObjectId(req.params.id as string) }},
        { $project: { gender: 1}},
        { $group: { _id:'$gender', userCount: { $sum:1 }}}
        ]).toArray()
    ])

    genderData.forEach( genderItem => {
      data.push({
      _id: genderItem._id,
      userCount: genderItem.userCount,
      userPercentage: (genderItem.userCount / totalUsers) * 100
    })
   })

  res.json({ success: true, data });
  } catch (error) {
    handleResponseError(
      `Segment gender data error: ${error.message}`,
      error.message,
      res
    );
  }
}